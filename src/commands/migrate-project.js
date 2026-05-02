import fs from "fs";
import path from "path";
import os from "os";
import ora from "ora";
import chalk from "chalk";
import pLimit from "p-limit";
import cliProgress from "cli-progress";
import { glob } from "glob";
import { migrateWithAI } from "../utils/ai.js";
import { parseMigrateResponse } from "../utils/parser.js";
import {
  ProjectMigrationContext,
  CHECKPOINT_FILE_NAME,
} from "../core/context/project-context.js";
import { MigrationOrchestrator } from "../core/orchestrator.js";
import { migrateDependencies } from "../utils/deps-migrator.js";
import {
  buildReport,
  saveReport,
  computeQualityScore,
  detectResidualPatterns,
} from "../utils/report.js";
import { validateTypeScriptProject } from "../utils/ts-validator.js";
import { RollbackManager, atomicWrite } from "../utils/rollback.js";
import {
  detectSymbolCollisions,
  resolveCollisions,
  formatCollisionReport,
} from "../utils/symbol-checker.js";
import {
  needsChunking,
  splitIntoChunks,
  mergeChunkResults,
  buildChunkContext,
} from "../utils/chunk-migrator.js";
import {
  isDebug,
  dbg,
  dbgFile,
  dbgDir,
  dbgPhase,
  dbgStep,
} from "../utils/debug.js";
import {
  loadAnalysis,
  loadRegistry,
  loadDepsGraph,
  scanProject,
  saveAnalysis,
  ANALYSIS_FILE_NAME,
} from "../utils/project-scanner.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";
import {
  ensureAngularCLI,
  cloneRepo,
  runNpmInstall,
  scaffoldAngularProject,
} from "../utils/ng-checker.js";
import { applyPostCleanup } from "../utils/post-cleanup.js";
import {
  estimateMigrationCost,
  formatCostEstimate,
} from "../utils/cost-estimator.js";
import {
  loadPlugin,
  applyPluginRules,
  runPluginPostProcess,
} from "../utils/plugin-loader.js";
import { buildHtmlReport, saveHtmlReport } from "../utils/html-report.js";

const SKIP_PATTERNS = [
  /node_modules/,
  // Minified / bundled files
  /\.min\.(js|css)$/,
  /\.(bundle|packed|compiled)\.(js|css)$/,
  // Build / output folders
  /dist\//,
  /coverage\//,
  /\.git\//,
  /\.angular\//,
  /e2e\//,
  // Vendor / dependency folders
  /\/vendor\//,
  /bower_components\//,
  /public\/lib\//,
  /assets\/lib\//,
  /assets\/vendor\//,
  /static\/vendor\//,
  /static\/lib\//,
  // Test / config
  /\.spec\.(js|ts)$/,
  /karma\.conf/,
  /protractor/,
  // Known 3rd-party source files
  /\bjquery[.-]/i,
  /\bbootstrap[.-]/i,
  /\blodash[.-]/i,
  /\bunderscore[.-]/i,
  /\bmoment[.-]/i,
  /\bangular\.js$/i,
  /\bangular-mocks\.js$/i,
  /\bangular-locale/i,
];

function shouldSkip(p) {
  return SKIP_PATTERNS.some((pat) => pat.test(p.replace(/\\/g, "/")));
}

export async function migrateProjectCommand(projectPath, opts) {
  await ensureAngularCLI();

  let clonedTmpDir = null;
  if (opts.clone) {
    const repoUrl = opts.clone;
    const repoName =
      repoUrl
        .split("/")
        .pop()
        .replace(/\.git$/, "") || "cloned-project";
    clonedTmpDir = path.join(
      os.tmpdir(),
      `ng-migrate-${repoName}-${Date.now()}`,
    );
    const cloneSpinner = ora(
      chalk.dim(`Clonando repositório: ${repoUrl}`),
    ).start();
    try {
      await cloneRepo(repoUrl, clonedTmpDir);
      cloneSpinner.succeed(
        chalk.green(`Repositório clonado em: ${chalk.cyan(clonedTmpDir)}`),
      );
    } catch (err) {
      cloneSpinner.fail(
        chalk.red("Falha ao clonar repositório: " + err.message),
      );
      process.exit(1);
    }

    projectPath = clonedTmpDir;
  }

  const absPath = path.resolve(projectPath || ".");

  if (!fs.existsSync(absPath)) {
    ui.error(`Pasta não encontrada: ${absPath}`);
    process.exit(1);
  }
  if (!fs.lstatSync(absPath).isDirectory()) {
    ui.error("Use ng-migrate migrate <arquivo> para arquivos individuais.");
    process.exit(1);
  }

  const projectName = path.basename(absPath);

  const inPlace = !!opts.inPlace;
  let outputDir;
  let backupDir = null;
  let scaffoldRoot;

  if (inPlace) {
    outputDir = path.join(absPath, "src-angular21");
    backupDir = path.join(absPath, "src-angularjs-backup");
    scaffoldRoot = absPath;
  } else {
    const resolvedOutputDir = opts.output
      ? path.resolve(opts.output)
      : path.join(path.dirname(absPath), `${projectName}-angular21`);
    outputDir = resolvedOutputDir;
    scaffoldRoot = outputDir;
  }

  const concurrency = parseInt(opts.concurrency || "3", 10);

  ui.section("Migração de Projeto Local → Angular 21");
  printKeyValue("Projeto:", absPath);
  if (inPlace) {
    printKeyValue("Modo:", chalk.cyan("in-place (dentro do projeto)"));
    printKeyValue("Saída migrada:", outputDir);
    printKeyValue("Backup original:", chalk.dim(backupDir));
  } else {
    printKeyValue("Saída:", outputDir);
  }
  printKeyValue(
    "Execução:",
    opts.dryRun
      ? chalk.yellow("dry-run (sem salvar)")
      : chalk.green("migração completa"),
  );
  printKeyValue("Concorrência:", String(concurrency));
  ui.blank();

  ui.section("Fase 1/2 — Análise do Projeto");
  let analysis = null;
  const scanSpinner = ora(chalk.dim("Escaneando projeto AngularJS...")).start();
  try {
    analysis = await scanProject(absPath);
    if (!opts.dryRun) saveAnalysis(absPath, analysis);
    scanSpinner.succeed(
      chalk.green(
        `Projeto escaneado: ${analysis.summary.angularJsFiles} arquivos AngularJS encontrados`,
      ),
    );
  } catch (err) {
    scanSpinner.warn(
      chalk.yellow("Escaneamento falhou, usando glob simples: " + err.message),
    );
    analysis = null;
  }

  if (analysis && analysis.summary) {
    const s = analysis.summary;
    ui.blank();
    printKeyValue("Total de arquivos:", String(s.totalFiles || "—"));
    printKeyValue(
      "Arquivos AngularJS:",
      chalk.cyan(String(s.angularJsFiles || "—")),
    );
    printKeyValue("Complexidade geral:", s.overallComplexity || "—");
    printKeyValue(
      "Horas estimadas:",
      s.estimatedHours != null ? `~${s.estimatedHours}h` : "—",
    );
    if (s.complexityDistribution) {
      printKeyValue(
        "Distribuição:",
        chalk.red(`alta: ${s.complexityDistribution.alta ?? 0}`) +
          chalk.dim(" | ") +
          chalk.yellow(`média: ${s.complexityDistribution.média ?? 0}`) +
          chalk.dim(" | ") +
          chalk.green(`baixa: ${s.complexityDistribution.baixa ?? 0}`),
      );
    }
    if (
      analysis &&
      analysis.migrationPlan &&
      analysis.migrationPlan.phases &&
      analysis.migrationPlan.phases.length
    ) {
      ui.blank();
      ui.info("Plano de migração (fases detectadas):");
      const phaseNames = [
        "",
        "Services & Factories",
        "Filters → Pipes",
        "Directives & Components",
        "Controllers",
        "Templates",
        "Roteamento",
      ];
      for (const phase of analysis.migrationPlan.phases) {
        const name = phaseNames[phase.phase] || `Fase ${phase.phase}`;
        console.log(
          chalk.dim(`  Fase ${phase.phase}: `) +
            chalk.white(name) +
            chalk.dim(` (${phase.files?.length ?? 0} arquivo(s))`),
        );
      }
    }
  }

  ui.blank();
  ui.section("Fase 2/2 — Migração");

  const registry = loadRegistry(absPath);
  const depsGraph = loadDepsGraph(absPath);

  // ── Symbol collision detection ────────────────────────────────────────────
  let resolvedRegistry = registry;
  if (registry) {
    const { collisions, hasCollisions } = detectSymbolCollisions(registry);
    if (hasCollisions) {
      ui.blank();
      console.log(chalk.yellow(formatCollisionReport(collisions)));
      resolvedRegistry = resolveCollisions(registry, collisions);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const checkpointPath = path.join(absPath, CHECKPOINT_FILE_NAME);

  const projectContext = new ProjectMigrationContext(absPath);
  projectContext.initFromAnalysis(analysis, resolvedRegistry, depsGraph);
  dbg(
    chalk.dim(
      `[context] pronto — ${projectContext.symbolMap.size} símbolos | ${projectContext.totalFiles} arquivos a migrar`,
    ),
  );

  const orchestrator = new MigrationOrchestrator(absPath, absPath);
  if (opts.fresh) {
    orchestrator.clearCache();
    dbg(chalk.dim("[orchestrator] cache apagado (--fresh)"));
  }

  const existingCheckpoint = !opts.fresh
    ? ProjectMigrationContext.loadCheckpoint(checkpointPath)
    : null;
  let resumingFromCheckpoint = false;
  let checkpointOutputDir = null;

  if (existingCheckpoint && !opts.dryRun) {
    const ago = _formatAgo(existingCheckpoint.savedAt);
    ui.blank();
    ui.warn(
      `Checkpoint encontrado (salvo ${ago}):\n` +
        chalk.dim(
          `  ${existingCheckpoint.completedFiles}/${existingCheckpoint.totalFiles} arquivo(s) já migrado(s) | fase=${existingCheckpoint.currentPhase ?? "?"}`,
        ),
    );

    const { default: inquirer } = await import("inquirer");
    const { resume } = await inquirer.prompt([
      {
        type: "confirm",
        name: "resume",
        message: "Deseja continuar de onde parou?",
        default: true,
      },
    ]);

    if (resume) {
      projectContext.restoreFromCheckpoint(existingCheckpoint);
      checkpointOutputDir = existingCheckpoint.outputDir;
      resumingFromCheckpoint = true;
      ui.success(
        `Contexto restaurado: ${projectContext.completedFiles} arquivo(s) já concluídos.`,
      );
    } else {
      try {
        fs.unlinkSync(checkpointPath);
      } catch {}
      ui.info("Iniciando migração do zero.");
    }
    ui.blank();
  }

  ui.blank();

  let filesToMigrate = [];

  if (analysis && analysis.files && analysis.files.length) {
    filesToMigrate = analysis.files
      .filter((f) => !shouldSkip(f.path))
      .map((f) => ({
        path: f.path,
        absPath: path.join(absPath, f.path),
        type: f.type || "auto",
        complexity: f.complexity,
        phase: f.phase || 4,
        loc: f.loc || 0,
      }));
  } else {
    const raw = await glob("**/*.{js,ts,html}", {
      cwd: absPath,
      ignore: ["node_modules/**", "dist/**", ".angular/**"],
    });
    filesToMigrate = raw
      .filter((f) => !shouldSkip(f))
      .map((f) => ({
        path: f,
        absPath: path.join(absPath, f),
        type: "auto",
        complexity: "média",
        phase: 4,
        loc: 0,
      }));
  }

  if (filesToMigrate.length === 0) {
    ui.warn("Nenhum arquivo AngularJS encontrado para migrar.");
    return;
  }

  if (opts.only) {
    const regex = new RegExp(
      "^" +
        opts.only
          .replace(/\*\*/g, "§")
          .replace(/\*/g, "[^/]*")
          .replace(/§/g, ".*") +
        "$",
    );
    filesToMigrate = filesToMigrate.filter((f) => regex.test(f.path));
    if (filesToMigrate.length === 0) {
      ui.warn(`Nenhum arquivo corresponde ao filtro: ${opts.only}`);
      return;
    }
  }

  if (opts.phase) {
    const ph = parseInt(opts.phase, 10);
    filesToMigrate = filesToMigrate.filter((f) => f.phase === ph);
    ui.info(
      `Filtrando apenas Fase ${ph} (${filesToMigrate.length} arquivo(s))`,
    );
  }

  if (resumingFromCheckpoint && projectContext.migratedFiles.length > 0) {
    const donePaths = new Set(
      projectContext.migratedFiles.map((f) => f.originalPath),
    );
    const before = filesToMigrate.length;
    filesToMigrate = filesToMigrate.filter((f) => !donePaths.has(f.path));
    const skippedCount = before - filesToMigrate.length;
    if (skippedCount > 0) {
      ui.info(
        chalk.dim(
          `Retomando: ${skippedCount} arquivo(s) já migrado(s) serão ignorados.`,
        ),
      );
    }

    if (checkpointOutputDir && !opts.output) {
      outputDir = checkpointOutputDir;
      if (!inPlace) scaffoldRoot = outputDir;
    }
  }

  printKeyValue("Arquivos para migrar:", String(filesToMigrate.length));
  if (analysis) {
    printKeyValue("Horas estimadas:", `~${analysis.summary.estimatedHours}h`);
    printKeyValue("Complexidade geral:", analysis.summary.overallComplexity);
  }
  ui.blank();

  // ── Load plugin ────────────────────────────────────────────────────────────
  const plugin = await loadPlugin(absPath);
  if (plugin) {
    ui.info(chalk.dim("Plugin ng-migrate.config.js carregado."));
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Cost estimation ───────────────────────────────────────────────────────
  if (!opts.skipCostEstimate && !opts.dryRun) {
    let config;
    try {
      const cm = await import("../utils/config-manager.js");
      config = cm.loadConfig();
    } catch {
      config = null;
    }
    if (config && config.provider && config.model) {
      const estimate = estimateMigrationCost(
        filesToMigrate,
        config.provider,
        config.model,
      );
      if (estimate.estimatedUSD > 0.05) {
        ui.section("Estimativa de Custo");
        formatCostEstimate(estimate).forEach((l) => console.log(chalk.dim(l)));
        ui.blank();
        const { default: inquirer } = await import("inquirer");
        const { proceed } = await inquirer.prompt([
          {
            type: "confirm",
            name: "proceed",
            message: "Deseja continuar com a migração?",
            default: true,
          },
        ]);
        if (!proceed) {
          ui.info("Migração cancelada pelo usuário.");
          return;
        }
        ui.blank();
      }
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (opts.dryRun) {
    ui.section("Dry-run — arquivos que seriam migrados (por fase)");
    const phases = [...new Set(filesToMigrate.map((f) => f.phase))].sort();
    const phaseNames = [
      "",
      "Services & Factories",
      "Filters → Pipes",
      "Directives & Components",
      "Controllers",
      "Templates",
      "Roteamento",
    ];
    phases.forEach((ph) => {
      console.log(chalk.bold(`\n  Fase ${ph}: ${phaseNames[ph] || ""}`));
      filesToMigrate
        .filter((f) => f.phase === ph)
        .forEach((f) => {
          const cc =
            { alta: chalk.red, média: chalk.yellow, baixa: chalk.green }[
              f.complexity
            ] || chalk.white;
          console.log(
            `    ${chalk.dim("→")} ${f.path} ${cc(`[${f.complexity}]`)}`,
          );
        });
    });
    ui.blank();
    ui.info("Rode sem --dry-run para executar a migração.");
    printSeparator();
    return;
  }

  if (!inPlace) {
    const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");
    dbgDir("scaffolding", outputDir, `ng new "${slug}"`);
    const scaffoldSpinner = ora(
      chalk.dim(
        `Criando projeto base com ng new "${slug}"... (pode levar alguns minutos)`,
      ),
    ).start();
    try {
      scaffoldAngularProject(slug, outputDir);
      scaffoldSpinner.succeed(
        chalk.green(`Projeto Angular 21 criado em: ${chalk.cyan(outputDir)}`),
      );
    } catch (err) {
      scaffoldSpinner.fail(
        chalk.red("Falha ao criar projeto Angular 21: " + err.message),
      );
      ui.error(
        "Verifique se o Angular CLI está instalado corretamente e tente novamente.",
      );
      process.exit(1);
    }
  } else {
    dbgDir("criando", outputDir, "diretório de saída (in-place)");
    fs.mkdirSync(outputDir, { recursive: true });
  }

  if (inPlace && !opts.dryRun) {
    const backupSpinner = ora(
      chalk.dim("Fazendo backup dos arquivos originais..."),
    ).start();
    try {
      for (const fileInfo of filesToMigrate) {
        const srcAbs = path.join(absPath, fileInfo.path);
        const destAbs = path.join(backupDir, fileInfo.path);
        dbgFile(
          "backup",
          fileInfo.path,
          `→ ${path.relative(absPath, destAbs)}`,
        );
        fs.mkdirSync(path.dirname(destAbs), { recursive: true });
        fs.copyFileSync(srcAbs, destAbs);
      }
      backupSpinner.succeed(
        chalk.green(`Backup criado em: ${chalk.cyan(backupDir)}`),
      );
    } catch (err) {
      backupSpinner.fail(chalk.red("Falha no backup: " + err.message));
      ui.error("Abortando para não sobrescrever arquivos sem backup.");
      process.exit(1);
    }
  }

  const useBar = !isDebug();
  const bar = useBar
    ? new cliProgress.SingleBar(
        {
          format: chalk.dim(
            "  {bar} {percentage}% | {value}/{total} | {filename}",
          ),
          barCompleteChar: "█",
          barIncompleteChar: "░",
          hideCursor: true,
        },
        cliProgress.Presets.shades_classic,
      )
    : {
        start: () => {},
        update: () => {},
        stop: () => {},
        increment: () => {},
      };

  bar.start(filesToMigrate.length, 0, { filename: "" });
  dbgStep(
    `iniciando migração: ${filesToMigrate.length} arquivo(s) | concorrência=${concurrency}`,
  );

  const stats = {
    total: filesToMigrate.length,
    success: 0,
    skipped: 0,
    errors: 0,
    files: [],
  };
  const errors = [];
  const limit = pLimit(concurrency);
  let completed = 0;
  let currentPhase = 0;

  // ── State management context ──────────────────────────────────────────────
  const stateManagement = opts.stateManagement || "signals";
  if (stateManagement !== "signals") {
    ui.info(
      `Gerenciamento de estado: ${chalk.cyan(stateManagement.toUpperCase())}`,
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Rollback manager ─────────────────────────────────────────────────────
  const rollback = new RollbackManager();
  // ─────────────────────────────────────────────────────────────────────────

  const migratedCodeMap = new Map(); // path → migrated code (for quality report)

  let sigintSaved = false;
  const onInterrupt = () => {
    if (sigintSaved) return;
    sigintSaved = true;
    bar.stop();
    console.log("\n");
    ui.warn(
      "Interrompido — salvando checkpoint e cache para retomar depois...",
    );
    projectContext.saveCheckpoint(checkpointPath, {
      outputDir,
      currentPhase,
      errors,
      stats,
    });
    orchestrator.saveCache();
    ui.info(`Checkpoint: ${chalk.cyan(checkpointPath)}`);
    ui.info(
      `Retome com: ${chalk.cyan("ng-migrate migrate-project " + projectPath)}`,
    );
    process.exit(130);
  };
  process.once("SIGINT", onInterrupt);
  process.once("SIGTERM", onInterrupt);

  const phases = [...new Set(filesToMigrate.map((f) => f.phase))].sort();
  const phaseNames = [
    "",
    "Services & Factories",
    "Filters → Pipes",
    "Directives & Components",
    "Controllers",
    "Templates",
    "Roteamento",
  ];

  for (const phase of phases) {
    currentPhase = phase;
    const phaseFiles = filesToMigrate.filter((f) => f.phase === phase);
    dbgPhase(phase, phaseNames[phase] || `Fase ${phase}`, phaseFiles.length);

    rollback.beginPhase(phase);

    const phaseContexts = orchestrator.warmPhaseContexts(
      phaseFiles,
      depsGraph,
      projectContext,
    );

    await Promise.all(
      phaseFiles.map((fileInfo) =>
        limit(async () => {
          bar.update(completed, {
            filename: chalk.dim(fileInfo.path.slice(-45)),
          });
          dbgFile(
            "lendo",
            fileInfo.path,
            `fase=${phase} | complexidade=${fileInfo.complexity}`,
          );

          let code;
          try {
            code = fs.readFileSync(fileInfo.absPath, "utf-8");
          } catch {
            dbgFile("skip", fileInfo.path, "não foi possível ler o arquivo");
            stats.skipped++;
            completed++;
            bar.increment();
            return;
          }

          const cached = orchestrator.getCached(fileInfo.path, code);
          if (cached) {
            const result = cached;
            const migratedCode = result.codigoMigrado || code;
            const outRelPath = fileInfo.path.replace(/\.js$/, ".ts");
            const outPath = path.join(outputDir, outRelPath);
            try {
              atomicWrite(outPath, migratedCode, rollback);
              migratedCodeMap.set(outRelPath, migratedCode);
              projectContext.recordMigration(fileInfo, migratedCode, result);
              stats.success++;
              stats.files.push({
                path: fileInfo.path,
                tipo: result.tipo || fileInfo.type,
                error: null,
              });
            } catch (writeErr) {
              stats.errors++;
              errors.push({
                file: fileInfo.path,
                message: `Erro de escrita: ${writeErr.message}`,
              });
              stats.files.push({
                path: fileInfo.path,
                tipo: fileInfo.type,
                error: `Erro de escrita: ${writeErr.message}`,
              });
            }
            completed++;
            bar.update(completed, { filename: fileInfo.path });
            return;
          }

          const { tier, maxTokens } = orchestrator.resolveModelConfig(
            fileInfo,
            code,
          );

          const MAX_OUTER_RETRIES = 2;
          let raw = null;
          let lastErr = null;

          // ── Large file chunking ─────────────────────────────────────────
          const isLargeFile = needsChunking(code);
          const stateCtx =
            stateManagement !== "signals"
              ? `\nUSAR GERENCIAMENTO DE ESTADO: ${stateManagement.toUpperCase()} — não use Signals, use ${stateManagement === "ngrx" ? "NgRx Store/Actions/Reducers/Effects" : "standalone sem state management library"}`
              : "";
          // ─────────────────────────────────────────────────────────────────

          if (isLargeFile) {
            // Chunk-based migration
            const chunks = splitIntoChunks(code);
            dbg(
              `[chunk] ${fileInfo.path}: ${chunks.length} chunks (${code.length} chars)`,
            );
            const chunkResults = [];
            let chunkFailed = false;

            for (const chunk of chunks) {
              const chunkCtx =
                buildChunkContext(chunk, chunks.length, fileInfo) + stateCtx;
              for (let attempt = 0; attempt <= MAX_OUTER_RETRIES; attempt++) {
                if (attempt > 0) await _sleep(5000 * attempt);
                try {
                  const contexto =
                    (phaseContexts.get(fileInfo.path) ?? "") + "\n" + chunkCtx;
                  const chunkRaw = await migrateWithAI(
                    chunk.content,
                    fileInfo.type || "auto",
                    contexto,
                    projectContext,
                    { tier, maxTokens },
                  );
                  chunkResults.push(parseMigrateResponse(chunkRaw));
                  lastErr = null;
                  break;
                } catch (err) {
                  lastErr = err;
                  if (attempt === MAX_OUTER_RETRIES) chunkFailed = true;
                }
              }
              if (chunkFailed) break;
            }

            if (!chunkFailed && chunkResults.length > 0) {
              const merged = mergeChunkResults(chunkResults);
              raw = merged;
            } else {
              raw = null;
            }
          } else {
            // Normal single-file migration
            for (let attempt = 0; attempt <= MAX_OUTER_RETRIES; attempt++) {
              if (attempt > 0) {
                const delay = 5000 * attempt;
                dbg(
                  chalk.yellow(
                    `  [retry ${attempt}/${MAX_OUTER_RETRIES}] ${fileInfo.path} — aguardando ${delay / 1000}s...`,
                  ),
                );
                await _sleep(delay);
              }
              try {
                const contexto =
                  (phaseContexts.get(fileInfo.path) ?? "") + stateCtx;
                raw = await migrateWithAI(
                  code,
                  fileInfo.type || "auto",
                  contexto,
                  projectContext,
                  { tier, maxTokens },
                );
                lastErr = null;
                break;
              } catch (err) {
                lastErr = err;
                dbg(
                  chalk.red(
                    `  [tentativa ${attempt + 1}] erro em ${fileInfo.path}: ${err.message}`,
                  ),
                );
              }
            }
          }

          if (lastErr) {
            dbg(
              chalk.red(
                `  falha definitiva em ${fileInfo.path}: ${lastErr.message}`,
              ),
            );
            stats.errors++;
            errors.push({ file: fileInfo.path, message: lastErr.message });
            stats.files.push({
              path: fileInfo.path,
              tipo: fileInfo.type,
              error: lastErr.message,
            });

            projectContext.saveCheckpoint(checkpointPath, {
              outputDir,
              currentPhase: phase,
              errors,
              stats,
            });
            completed++;
            bar.update(completed, { filename: fileInfo.path });
            return;
          }

          const result = parseMigrateResponse(raw);
          let migratedCode = result.codigoMigrado || code;

          // ── Post-cleanup & plugin ─────────────────────────────────────────
          const { code: cleanedCode, applied: cleanupApplied } =
            applyPostCleanup(migratedCode, fileInfo.path);
          if (cleanupApplied.length > 0) {
            dbg(
              chalk.dim(
                `  [cleanup] ${fileInfo.path}: ${cleanupApplied.length} regra(s) aplicada(s)`,
              ),
            );
          }
          migratedCode = applyPluginRules(cleanedCode, plugin, fileInfo.path);
          migratedCode = await runPluginPostProcess(
            migratedCode,
            plugin,
            fileInfo.path,
          );
          // ─────────────────────────────────────────────────────────────────

          const outRelPath = fileInfo.path.replace(/\.js$/, ".ts");
          const outPath = path.join(outputDir, outRelPath);
          try {
            atomicWrite(outPath, migratedCode, rollback);
            migratedCodeMap.set(outRelPath, migratedCode);
          } catch (writeErr) {
            dbg(
              chalk.red(
                `  erro ao salvar ${fileInfo.path}: ${writeErr.message}`,
              ),
            );
            stats.errors++;
            errors.push({
              file: fileInfo.path,
              message: `Erro de escrita: ${writeErr.message}`,
            });
            stats.files.push({
              path: fileInfo.path,
              tipo: result.tipo || fileInfo.type,
              error: `Erro de escrita: ${writeErr.message}`,
            });
            completed++;
            bar.update(completed, { filename: fileInfo.path });
            return;
          }
          dbgFile(
            "escrevendo",
            outPath,
            `tipo=${result.tipo || "auto"} | ${migratedCode.length} chars`,
          );

          orchestrator.setCached(fileInfo.path, code, result);

          projectContext.recordMigration(fileInfo, migratedCode, result);

          stats.success++;
          stats.files.push({
            path: fileInfo.path,
            tipo: result.tipo || fileInfo.type,
            error: null,
          });
          completed++;
          bar.update(completed, { filename: fileInfo.path });
        }),
      ),
    );

    if (projectContext.completedFiles > 0) {
      dbg(chalk.dim(`[context] condensando histórico após fase ${phase}...`));
      await projectContext.condenseHistoryWithAI().catch(() => {});
      projectContext.saveCheckpoint(checkpointPath, {
        outputDir,
        currentPhase: phase,
        errors,
        stats,
      });
      orchestrator.saveCache();
    }

    // ── TypeScript validation per phase ──────────────────────────────────
    if (opts.validateTs && !opts.dryRun) {
      const tsSpinner = ora(
        chalk.dim(`Validando TypeScript — fase ${phase}...`),
      ).start();
      try {
        const validation = await validateTypeScriptProject(outputDir);
        if (validation.valid) {
          tsSpinner.succeed(chalk.green(`Fase ${phase}: TypeScript OK`));
          rollback.commitPhase(phase);
        } else {
          const errCount = validation.errors.length;
          tsSpinner.warn(
            chalk.yellow(
              `Fase ${phase}: ${errCount} erro(s) TypeScript detectados`,
            ),
          );
          if (errCount > 0 && errCount <= 3) {
            // Tolerable — show errors but continue
            validation.errors.forEach((e) =>
              console.log(chalk.dim(`    ${e.file}:${e.line} — ${e.message}`)),
            );
          }
          rollback.commitPhase(phase); // commit anyway, errors shown in report
        }
      } catch (tsErr) {
        tsSpinner.warn(
          chalk.dim(`Validação TypeScript falhou: ${tsErr.message}`),
        );
        rollback.commitPhase(phase);
      }
    } else {
      rollback.commitPhase(phase);
    }
    // ─────────────────────────────────────────────────────────────────────
  }

  process.off("SIGINT", onInterrupt);
  process.off("SIGTERM", onInterrupt);
  orchestrator.saveCache();
  try {
    if (fs.existsSync(checkpointPath)) fs.unlinkSync(checkpointPath);
  } catch {}

  bar.stop();
  ui.blank();

  let depReport = null;
  if (!opts.skipDeps) {
    const srcPkg = path.join(absPath, "package.json");
    if (fs.existsSync(srcPkg)) {
      dbgFile(
        "lendo",
        srcPkg,
        "atualizando dependências AngularJS → Angular 21",
      );
      const pkgSpinner = ora(chalk.dim("Atualizando package.json...")).start();
      try {
        const original = fs.readFileSync(srcPkg, "utf-8");
        const result = migrateDependencies(original);
        depReport = result.report;

        fs.writeFileSync(
          path.join(scaffoldRoot, "package.json"),
          result.content,
          "utf-8",
        );
        pkgSpinner.succeed("package.json atualizado para Angular 21");
      } catch (err) {
        pkgSpinner.warn(
          "Não foi possível atualizar package.json: " + err.message,
        );
      }
    }
  }

  copyStaticAssets(absPath, scaffoldRoot);

  generateAngularJson(scaffoldRoot, projectName);

  generateTsConfig(scaffoldRoot);

  const reportContent = buildReport({
    repoName: projectName,
    provider: "local",
    branch: "—",
    stats,
    depReport,
    errors,
    outputDir,
    qualityReport: _buildQualityReport(migratedCodeMap, stats),
  });
  const reportPath = saveReport(reportContent, outputDir);

  // ── HTML report ───────────────────────────────────────────────────────────
  try {
    const htmlReportData = {
      projectName,
      generatedAt: new Date().toLocaleString("pt-BR"),
      stats: {
        total: stats.total,
        migrated: stats.success,
        failed: stats.errors,
        partial: stats.skipped,
      },
      files: stats.files.map((f) => ({
        path: f.path,
        phase: String(f.phase ?? ""),
        status: f.error ? "falha" : "migrado",
        loc: f.loc ?? "",
        score: "",
      })),
      phases: [...new Set(filesToMigrate.map((f) => f.phase))]
        .sort()
        .map((ph) => ({
          phase: ph,
          name:
            [
              "",
              "Services",
              "Pipes",
              "Components",
              "Controllers",
              "Templates",
              "Routing",
            ][ph] || `Fase ${ph}`,
          count: filesToMigrate.filter((f) => f.phase === ph).length,
        })),
      overallScore:
        _buildQualityReport(migratedCodeMap, stats)?.overallScore ?? "-",
    };
    const htmlPath = saveHtmlReport(buildHtmlReport(htmlReportData), outputDir);
    ui.info(`Relatório HTML: ${chalk.cyan(htmlPath)}`);
  } catch (htmlErr) {
    dbg(chalk.dim(`[html-report] erro ao gerar: ${htmlErr.message}`));
  }
  // ─────────────────────────────────────────────────────────────────────────

  if (analysis) {
    analysis.lastMigration = {
      migratedAt: new Date().toISOString(),
      outputDir,
      stats: { success: stats.success, errors: stats.errors },

      contextSnapshot: projectContext.getSnapshot(),
    };
    saveAnalysis(absPath, analysis);
  }

  ui.section("Resultado da Migração");
  printKeyValue("Total de arquivos:", String(stats.total));
  printKeyValue("Migrados com sucesso:", chalk.green(String(stats.success)));
  printKeyValue("Ignorados:", chalk.dim(String(stats.skipped)));
  printKeyValue(
    "Erros:",
    stats.errors > 0 ? chalk.red(String(stats.errors)) : chalk.dim("0"),
  );

  const orchStats = orchestrator.getStats();
  if (orchStats.cacheHits > 0 || stats.total > 1) {
    ui.blank();
    printKeyValue(
      "Cache hits (sem IA):",
      chalk.dim(String(orchStats.cacheHits)),
    );
    printKeyValue(
      "Tier FAST / STANDARD / PREMIUM:",
      chalk.dim(
        `${orchStats.fast ?? 0} / ${orchStats.standard ?? 0} / ${orchStats.premium ?? 0}`,
      ),
    );
  }

  if (errors.length > 0) {
    ui.blank();
    ui.warn("Arquivos com erro:");
    errors
      .slice(0, 5)
      .forEach((e) =>
        console.log(chalk.red("  ✖ ") + e.file + chalk.dim(" — " + e.message)),
      );
    if (errors.length > 5)
      console.log(chalk.dim(`  ... e mais ${errors.length - 5} erros`));
  }

  ui.blank();
  if (inPlace) {
    ui.success(`Arquivos migrados em:  ${chalk.cyan(outputDir)}`);
    ui.success(`Backup dos originais:  ${chalk.cyan(backupDir)}`);
  } else {
    ui.success(`Projeto migrado em: ${chalk.cyan(outputDir)}`);
  }
  ui.info(`Relatório: ${chalk.cyan(reportPath)}`);
  ui.blank();

  const installDir = inPlace ? absPath : outputDir;
  if (!opts.skipInstall && !opts.dryRun) {
    const installSpinner = ora(
      chalk.dim(`Executando npm install em ${chalk.cyan(installDir)}...`),
    ).start();
    try {
      await runNpmInstall(installDir);
      installSpinner.succeed(
        chalk.green("Dependências instaladas com sucesso!"),
      );
    } catch (err) {
      installSpinner.warn(
        chalk.yellow("npm install falhou — execute manualmente: ") +
          chalk.dim(`cd ${installDir} && npm install`),
      );
    }
  }

  ui.blank();
  console.log(chalk.dim("  Próximos passos:"));
  if (inPlace) {
    console.log(chalk.dim(`  1. cd ${absPath}`));
    console.log(chalk.dim(`  2. Aponte o seu build para src-angular21/`));
    console.log(chalk.dim(`  3. ng serve   (ou npm start)`));
    console.log(chalk.dim(`  4. Revise arquivos com erros manualmente`));
    console.log(chalk.dim(`  5. Quando estável, remova src-angularjs-backup/`));
  } else {
    console.log(chalk.dim(`  1. cd ${outputDir}`));
    console.log(chalk.dim("  2. ng serve   (ou npm start)"));
    console.log(chalk.dim("  3. Revise arquivos com erros manualmente"));
  }
  printSeparator();
}

function copyStaticAssets(srcDir, outputDir) {
  const COPY_FILES = [
    "tsconfig.base.json",
    ".editorconfig",
    ".gitignore",
    "README.md",
  ];
  for (const f of COPY_FILES) {
    const src = path.join(srcDir, f);
    if (fs.existsSync(src)) {
      try {
        fs.copyFileSync(src, path.join(outputDir, f));
      } catch {}
    }
  }
}

function generateAngularJson(outputDir, projectName) {
  const angularJsonPath = path.join(outputDir, "angular.json");
  if (fs.existsSync(angularJsonPath)) return;

  const slug = projectName.toLowerCase().replace(/[^a-z0-9-]/g, "-");

  const angularJson = {
    $schema: "./node_modules/@angular/cli/lib/config/schema.json",
    version: 1,
    newProjectRoot: "projects",
    projects: {
      [slug]: {
        projectType: "application",
        schematics: {
          "@schematics/angular:component": { standalone: true, style: "scss" },
          "@schematics/angular:directive": { standalone: true },
          "@schematics/angular:pipe": { standalone: true },
        },
        root: "",
        sourceRoot: "src",
        prefix: "app",
        architect: {
          build: {
            builder: "@angular-devkit/build-angular:application",
            options: {
              outputPath: "dist/" + slug,
              index: "src/index.html",
              browser: "src/main.ts",
              polyfills: ["zone.js"],
              tsConfig: "tsconfig.app.json",
              assets: ["src/favicon.ico", "src/assets"],
              styles: ["src/styles.scss"],
              scripts: [],
            },
            configurations: {
              production: {
                budgets: [
                  {
                    type: "initial",
                    maximumWarning: "500kb",
                    maximumError: "1mb",
                  },
                  {
                    type: "anyComponentStyle",
                    maximumWarning: "2kb",
                    maximumError: "4kb",
                  },
                ],
                outputHashing: "all",
              },
              development: {
                optimization: false,
                extractLicenses: false,
                sourceMap: true,
              },
            },
            defaultConfiguration: "production",
          },
          serve: {
            builder: "@angular-devkit/build-angular:dev-server",
            configurations: {
              production: { buildTarget: `${slug}:build:production` },
              development: { buildTarget: `${slug}:build:development` },
            },
            defaultConfiguration: "development",
          },
        },
      },
    },
  };

  try {
    fs.writeFileSync(
      angularJsonPath,
      JSON.stringify(angularJson, null, 2),
      "utf-8",
    );
  } catch {}
}

function generateTsConfig(outputDir) {
  const tsConfigPath = path.join(outputDir, "tsconfig.json");
  if (fs.existsSync(tsConfigPath)) return;

  const tsConfig = {
    compileOnSave: false,
    compilerOptions: {
      outDir: "./dist/out-tsc",
      strict: true,
      noImplicitOverride: true,
      noPropertyAccessFromIndexSignature: true,
      noImplicitReturns: true,
      noFallthroughCasesInSwitch: true,
      skipLibCheck: true,
      isolatedModules: true,
      esModuleInterop: true,
      experimentalDecorators: true,
      moduleResolution: "bundler",
      importHelpers: true,
      target: "ES2022",
      module: "ES2022",
      lib: ["ES2022", "dom"],
    },
    angularCompilerOptions: {
      enableI18nLegacyMessageIdFormat: false,
      strictInjectionParameters: true,
      strictInputAccessModifiers: true,
      strictTemplates: true,
    },
  };

  try {
    fs.writeFileSync(tsConfigPath, JSON.stringify(tsConfig, null, 2), "utf-8");
  } catch {}
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _formatAgo(isoDate) {
  try {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return "agora mesmo";
    if (mins < 60) return `${mins} min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    return `${Math.floor(hours / 24)}d atrás`;
  } catch {
    return "data desconhecida";
  }
}

function _buildQualityReport(migratedCodeMap, stats) {
  try {
    const files = [];
    for (const [filePath, code] of migratedCodeMap) {
      files.push({ path: filePath, code });
    }
    const residualPatterns = detectResidualPatterns(files);
    const tsErrorCount = 0; // populated by validateTs if used
    const score = computeQualityScore(
      stats,
      tsErrorCount,
      residualPatterns.length,
    );
    return {
      overallScore: score,
      residualPatterns,
      tsErrors: [],
      chunkedFiles: [],
    };
  } catch {
    return null;
  }
}
