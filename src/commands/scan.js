import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import cliProgress from "cli-progress";
import pLimit from "p-limit";
import { analyzeWithAI } from "../utils/ai.js";
import { parseAnalyzeResponse } from "../utils/parser.js";
import { ProjectMigrationContext } from "../core/context/project-context.js";
import {
  scanProject,
  saveAnalysis,
  loadAnalysis,
  ANALYSIS_FILE_NAME,
} from "../utils/project-scanner.js";
import { buildFullLibReport } from "../utils/lib-mapper.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";
import { isDebug, dbgFile, dbgAI, dbgScan, dbgStep } from "../utils/debug.js";

const COMPLEXITY_COLOR = {
  baixa: chalk.green,
  média: chalk.yellow,
  alta: chalk.red,
};

export async function scanCommand(projectPath, opts) {
  const absPath = path.resolve(projectPath || ".");

  if (!fs.existsSync(absPath)) {
    ui.error(`Pasta não encontrada: ${absPath}`);
    process.exit(1);
  }

  const isDir = fs.lstatSync(absPath).isDirectory();
  if (!isDir) {
    ui.error("O comando scan requer uma pasta de projeto.");
    process.exit(1);
  }

  ui.section("Análise de Projeto AngularJS");
  printKeyValue("Projeto:", absPath);
  printKeyValue(
    "Análise AI:",
    opts.ai
      ? chalk.green("ativada (análise profunda por arquivo)")
      : chalk.dim("desativada — use --ai para análise profunda"),
  );
  if (opts.force) printKeyValue("Modo:", chalk.yellow("forçando nova análise"));
  ui.blank();

  const existing = !opts.force && loadAnalysis(absPath);
  if (existing) {
    ui.info(
      `Análise existente de ${chalk.cyan(new Date(existing.scannedAt).toLocaleString())} encontrada.`,
    );
    ui.info(`Use ${chalk.cyan("--force")} para sobrescrever.\n`);
    if (opts.json) {
      console.log(JSON.stringify(existing, null, 2));
      return;
    }
    printSummary(existing);
    printSeparator();
    return;
  }

  const scanSpinner = ora(
    chalk.dim("Escaneando arquivos do projeto..."),
  ).start();
  let analysis;

  try {
    analysis = await scanProject(absPath, { includeAll: opts.includeAll });
    scanSpinner.succeed(
      chalk.green(
        `Escaneamento concluído — ${analysis.summary.angularJsFiles} arquivo(s) AngularJS em ${analysis.summary.totalFiles} arquivos totais`,
      ),
    );
    if (analysis.files?.length) {
      for (const f of analysis.files) {
        dbgScan(f.path, f.patterns, f.complexity);
      }
    }
  } catch (err) {
    scanSpinner.fail(chalk.red("Erro no escaneamento: " + err.message));
    process.exit(1);
  }

  if (analysis.summary.angularJsFiles === 0) {
    ui.blank();
    ui.warn("Nenhum padrão AngularJS detectado no projeto.");
    return;
  }

  if (opts.ai && analysis.files.length > 0) {
    ui.blank();
    ui.info(`Iniciando análise AI para ${analysis.files.length} arquivo(s)...`);
    dbgStep(
      `análise IA: ${analysis.files.length} arquivo(s) | provedor configurado`,
    );

    const scanContext = new ProjectMigrationContext(absPath);
    scanContext.initFromAnalysis(analysis, analysis.registry || null, null);
    dbgStep(
      `[context] scan context inicializado — ${scanContext.symbolMap.size} símbolos`,
    );

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
      : { start: () => {}, update: () => {}, stop: () => {} };

    bar.start(analysis.files.length, 0, { filename: "" });
    let done = 0;
    const lock = {};
    const updateBar = (filename) => {
      if (!lock.busy) {
        lock.busy = true;
        bar.update(done, { filename });
        lock.busy = false;
      }
    };

    const scanConcurrency = parseInt(
      process.env.NG_MIGRATE_SCAN_CONCURRENCY || "4",
      10,
    );
    const limit = pLimit(scanConcurrency);
    const startTime = Date.now();

    const tasks = analysis.files.map((fileInfo) =>
      limit(async () => {
        updateBar(fileInfo.path);
        try {
          const absFilePath = path.join(absPath, fileInfo.path);
          dbgFile(
            "lendo",
            fileInfo.path,
            `${fs.statSync(absFilePath).size} bytes`,
          );
          const code = fs.readFileSync(absFilePath, "utf-8");
          dbgAI(
            "enviando",
            "analysis",
            `arquivo=${fileInfo.path} | ${code.length} chars`,
          );
          const raw = await analyzeWithAI(code, fileInfo.path, scanContext);
          const ai = parseAnalyzeResponse(raw);
          dbgAI(
            "resposta",
            "analysis",
            `arquivo=${fileInfo.path} | complexidade=${ai.complexidade || "?"} | padrões=${ai.padroes?.length || 0}`,
          );

          fileInfo.aiAnalysis = {
            complexity: ai.complexidade || fileInfo.complexity,
            patterns: ai.padroes?.length ? ai.padroes : fileInfo.patterns,
            problems: ai.problemas?.length ? ai.problemas : fileInfo.problems,
            migrationOrder: ai.ordemSugerida || [],
            summary: ai.resumo || "",
            dependencies: ai.dependencias?.length
              ? ai.dependencias
              : fileInfo.dependencies,
          };

          if (ai.complexidade) fileInfo.complexity = ai.complexidade;
        } catch (err) {
          dbgAI("erro", "analysis", `arquivo=${fileInfo.path}: ${err.message}`);
          fileInfo.aiAnalysis = { error: `Análise AI falhou: ${err.message}` };
        }
        done++;
        updateBar(fileInfo.path);
      }),
    );

    await Promise.all(tasks);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    bar.stop();
    analysis.summary.aiAnalysisEnabled = true;
    analysis.summary.aiAnalysisElapsedSec = parseFloat(elapsed);
    ui.success(
      `Análise AI concluída em ${elapsed}s (${scanConcurrency} paralelo(s))`,
    );
  }

  printSummary(analysis);

  // ── Library migration report from package.json ──────────────────────────
  const pkgPath = path.join(absPath, "package.json");
  let libReport = null;
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      libReport = buildFullLibReport(pkg);
      analysis.libReport = libReport;
      printLibSummary(libReport);
    } catch {
      // package.json unreadable — silently skip
    }
  }

  if (!opts.noSave) {
    const saved = saveAnalysis(absPath, analysis);
    ui.blank();
    ui.success(`Análise salva em:          ${chalk.cyan(saved.analysisFile)}`);
    ui.success(`Registro de símbolos:      ${chalk.cyan(saved.registryFile)}`);
    ui.success(`Grafo de dependências:     ${chalk.cyan(saved.graphFile)}`);

    const reg = analysis.registry;
    if (reg?.symbols?.length > 0) {
      ui.blank();
      ui.section("Símbolos Detectados (Registro)");
      const byKind = {};
      for (const s of reg.symbols) {
        byKind[s.kind] = (byKind[s.kind] || 0) + 1;
      }
      for (const [kind, count] of Object.entries(byKind)) {
        printKeyValue(`  ${kind}:`, String(count));
      }
      if (reg.routes?.length > 0) {
        printKeyValue("  rotas:", String(reg.routes.length));
      }
      const definedModules = reg.modules?.filter((m) => !m.referenceOnly) || [];
      if (definedModules.length > 0) {
        printKeyValue("  módulos Angular:", String(definedModules.length));
      }
    }

    ui.blank();
    ui.info(
      `Use ${chalk.cyan("ng-migrate migrate-project <pasta>")} para migrar guiado por esta análise.`,
    );
  }

  if (opts.json) {
    console.log(JSON.stringify(analysis, null, 2));
  }

  printSeparator();
}

function printSummary(analysis) {
  const { summary, migrationPlan, files } = analysis;

  ui.blank();
  ui.section("Resumo do Projeto");

  const cc = COMPLEXITY_COLOR[summary.overallComplexity] || chalk.white;
  printKeyValue(
    "Complexidade geral:",
    cc(summary.overallComplexity.toUpperCase()),
  );
  printKeyValue("Arquivos AngularJS:", String(summary.angularJsFiles));
  printKeyValue("Total de linhas:", String(summary.totalLoc));
  printKeyValue("Horas estimadas:", `~${summary.estimatedHours}h`);
  printKeyValue("Versão Angular:", summary.angularVersion || "desconhecida");
  ui.blank();

  printKeyValue(
    "Complexidade alta:",
    chalk.red(String(summary.complexityDistribution.alta)),
  );
  printKeyValue(
    "Complexidade média:",
    chalk.yellow(String(summary.complexityDistribution.média)),
  );
  printKeyValue(
    "Complexidade baixa:",
    chalk.green(String(summary.complexityDistribution.baixa)),
  );

  if (summary.topPatterns?.length) {
    ui.blank();
    ui.section("Padrões AngularJS Mais Frequentes");
    summary.topPatterns.slice(0, 10).forEach(({ name, count }) => {
      const bar = "█".repeat(Math.min(count, 20));
      console.log(
        `  ${chalk.red(bar)} ${chalk.dim(name)} ${chalk.yellow(`(${count}x)`)}`,
      );
    });
  }

  if (migrationPlan?.phases?.length) {
    ui.blank();
    ui.section("Plano de Migração por Fases");
    migrationPlan.phases.forEach((phase) => {
      const count = phase.files.length;
      console.log(
        chalk.bold(`  Fase ${phase.phase}: ${phase.name} `) +
          chalk.dim(`(${count} arquivo${count !== 1 ? "s" : ""})`),
      );
      phase.files
        .slice(0, 4)
        .forEach((f) => console.log(chalk.dim(`    → ${f}`)));
      if (count > 4)
        console.log(chalk.dim(`    ... e mais ${count - 4} arquivo(s)`));
    });
  }

  const allProblems = files.flatMap((f) => f.problems || []);
  if (allProblems.length > 0) {
    const freq = {};
    allProblems.forEach((p) => {
      freq[p] = (freq[p] || 0) + 1;
    });
    ui.blank();
    ui.section("Principais Problemas Detectados");
    Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .forEach(([p, n]) =>
        console.log(
          chalk.yellow("  ⚠ ") + chalk.dim(`${p} `) + chalk.dim(`(${n}x)`),
        ),
      );
  }

  const highFiles = files.filter((f) => f.complexity === "alta").slice(0, 6);
  if (highFiles.length > 0) {
    ui.blank();
    ui.section("Arquivos de Alta Complexidade (prioridade de atenção)");
    highFiles.forEach((f) => {
      console.log(
        chalk.red("  ✖ ") +
          chalk.bold(f.path) +
          chalk.dim(
            ` — ${f.loc} linhas, ${f.patterns.length} padrões, ~${f.estimatedHours}h`,
          ),
      );
    });
  }
}

/**
 * Imprime o resumo do relatório de bibliotecas após o scan do projeto.
 * @param {object} libReport - Resultado de buildFullLibReport()
 */
function printLibSummary(libReport) {
  const { toReplace, toDrop, manual, unknown, totalDeps } = libReport;
  const hasAny =
    toReplace.length + toDrop.length + manual.length + unknown.length > 0;

  ui.blank();
  ui.section("Bibliotecas — Análise do package.json");

  if (!hasAny) {
    printKeyValue("Total de dependências:", String(totalDeps));
    ui.info("Nenhuma biblioteca AngularJS identificada.");
    return;
  }

  printKeyValue("Total de dependências:", String(totalDeps));
  if (toReplace.length > 0)
    printKeyValue(
      chalk.green("  ✔ A substituir:"),
      chalk.green(String(toReplace.length)),
    );
  if (toDrop.length > 0)
    printKeyValue(
      chalk.red("  ✖ A remover:"),
      chalk.red(String(toDrop.length)),
    );
  if (manual.length > 0)
    printKeyValue(
      chalk.yellow("  ⚠ Migração manual:"),
      chalk.yellow(String(manual.length)),
    );
  if (unknown.length > 0)
    printKeyValue(
      chalk.dim("  ? Sem mapeamento:"),
      chalk.dim(String(unknown.length)),
    );

  if (toReplace.length > 0) {
    ui.blank();
    console.log(chalk.bold("  Substituições principais:"));
    for (const lib of toReplace.slice(0, 8)) {
      console.log(
        `    ${chalk.red(lib.from)} → ${chalk.green(lib.to.join(", "))}`,
      );
    }
    if (toReplace.length > 8) {
      console.log(
        chalk.dim(
          `    ... e mais ${toReplace.length - 8} (use ng-migrate libs para ver tudo)`,
        ),
      );
    }
  }

  if (toDrop.length > 0) {
    ui.blank();
    console.log(chalk.bold("  Serão removidas:"));
    for (const lib of toDrop.slice(0, 6)) {
      console.log(`    ${chalk.red("✖")} ${chalk.dim(lib.name)}`);
    }
    if (toDrop.length > 6) {
      console.log(chalk.dim(`    ... e mais ${toDrop.length - 6}`));
    }
  }

  ui.blank();
  ui.info(
    `Execute ${chalk.cyan("ng-migrate libs <pasta>")} para o relatório completo de bibliotecas.`,
  );
}
