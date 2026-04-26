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
import { migrateDependencies } from "../utils/deps-migrator.js";
import { buildReport, saveReport } from "../utils/report.js";
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

const SKIP_PATTERNS = [
    /node_modules/,
    /\.min\.js$/,
    /dist\//,
    /coverage\//,
    /\.git\//,
    /\.angular\//,
    /e2e\//,
    /\.spec\.(js|ts)$/,
    /karma\.conf/,
    /protractor/,
];

function shouldSkip(p) {
    return SKIP_PATTERNS.some((pat) => pat.test(p.replace(/\\/g, "/")));
}

// ── Main command ──────────────────────────────────────────────────────────────

export async function migrateProjectCommand(projectPath, opts) {
    // ── Check / install Angular CLI ────────────────────────────────────────────
    await ensureAngularCLI();

    // ── Optional: clone repo before migrating ─────────────────────────────────
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
        // Override projectPath to the cloned directory
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

    // ── Resolve output strategy ────────────────────────────────────────────────
    const inPlace = !!opts.inPlace;
    let outputDir;
    let backupDir = null;
    let scaffoldRoot; // where angular.json / tsconfig / package.json go

    if (inPlace) {
        outputDir = path.join(absPath, "src-angular21");
        backupDir = path.join(absPath, "src-angularjs-backup");
        scaffoldRoot = absPath; // scaffold files go to the project root
    } else {
        outputDir = opts.output ?
            path.resolve(opts.output) :
            path.join(path.dirname(absPath), `${projectName}-angular21`);
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
        opts.dryRun ?
        chalk.yellow("dry-run (sem salvar)") :
        chalk.green("migração completa"),
    );
    printKeyValue("Concorrência:", String(concurrency));
    ui.blank();

    // ── Always scan before migrating ──────────────────────────────────────────
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

    // Print scan summary
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
        if (analysis && analysis.migrationPlan && analysis.migrationPlan.phases && analysis.migrationPlan.phases.length) {
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

    // Load registry and deps graph for AI context
    const registry = loadRegistry(absPath);
    const depsGraph = loadDepsGraph(absPath);

    ui.blank();

    // ── Build file list ────────────────────────────────────────────────────────
    let filesToMigrate = [];

    if (analysis && analysis.files && analysis.files.length) {
        // Use phase-sorted order from analysis
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

    // ── Apply glob filter ──────────────────────────────────────────────────────
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

    // ── Phase filter ───────────────────────────────────────────────────────────
    if (opts.phase) {
        const ph = parseInt(opts.phase, 10);
        filesToMigrate = filesToMigrate.filter((f) => f.phase === ph);
        ui.info(
            `Filtrando apenas Fase ${ph} (${filesToMigrate.length} arquivo(s))`,
        );
    }

    printKeyValue("Arquivos para migrar:", String(filesToMigrate.length));
    if (analysis) {
        printKeyValue("Horas estimadas:", `~${analysis.summary.estimatedHours}h`);
        printKeyValue("Complexidade geral:", analysis.summary.overallComplexity);
    }
    ui.blank();

    // ── Dry-run: just show list ────────────────────────────────────────────────
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
                                const cc = { alta: chalk.red, média: chalk.yellow, baixa: chalk.green }[
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

  // ── Scaffold base Angular 21 project via `ng new` (non-inPlace only) ────────
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
    // in-place: apenas cria o diretório de saída dos arquivos migrados
    dbgDir("criando", outputDir, "diretório de saída (in-place)");
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // ── In-place: backup original source files ────────────────────────────────
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

  // ── Progress bar ───────────────────────────────────────────────────────────
  // In debug mode the bar is replaced by per-file log lines
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

  // ── Process phase by phase (parallel within same phase) ───────────────────
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
    const phaseFiles = filesToMigrate.filter((f) => f.phase === phase);
    dbgPhase(phase, phaseNames[phase] || `Fase ${phase}`, phaseFiles.length);

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
          try {
            code = fs.readFileSync(fileInfo.absPath, "utf-8");
          } catch {
            dbgFile("skip", fileInfo.path, "não foi possível ler o arquivo");
            stats.skipped++;
            completed++;
            bar.increment();
            return;
          }

          let raw;
          try {
            // Build context hint from registry (rename map + direct dependencies)
            let contexto = "";
            if (registry?.renameMap) {
              const fileDeps = depsGraph?.graph?.[fileInfo.path]?.injects || [];
              const relevantRenames = fileDeps
                .filter((d) => registry.renameMap[d])
                .map((d) => `${d} → ${registry.renameMap[d]}`);
              if (relevantRenames.length > 0) {
                contexto = `Dependências injetadas neste arquivo (use os nomes Angular sugeridos):\n${relevantRenames.join("\n")}`;
              }
              // Also add the file's own registered name
              const ownSymbol = registry.symbols?.find(
                (s) => s.file === fileInfo.path,
              );
              if (ownSymbol) {
                contexto += `\nEste arquivo registra: ${ownSymbol.angularName} → renomear para ${ownSymbol.suggestedClassName}`;
              }
            }
            raw = await migrateWithAI(code, fileInfo.type || "auto", contexto);
          } catch (err) {
            dbg(chalk.red(`  erro em ${fileInfo.path}: ${err.message}`));
            stats.errors++;
            errors.push({ file: fileInfo.path, message: err.message });
            stats.files.push({
              path: fileInfo.path,
              tipo: fileInfo.type,
              error: err.message,
            });
            completed++;
            bar.update(completed, { filename: fileInfo.path });
            return;
          }

          const result = parseMigrateResponse(raw);
          const migratedCode = result.codigoMigrado || code; // fallback to original if parse failed

          // Determine output path (convert .js → .ts when content is TypeScript)
          const outRelPath = fileInfo.path.replace(/\.js$/, ".ts");
          const outPath = path.join(outputDir, outRelPath);
          fs.mkdirSync(path.dirname(outPath), { recursive: true });
          fs.writeFileSync(outPath, migratedCode, "utf-8");
          dbgFile(
            "escrevendo",
            outPath,
            `tipo=${result.tipo || "auto"} | ${migratedCode.length} chars`,
          );

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
  }

  bar.stop();
  ui.blank();

  // ── Migrate package.json ───────────────────────────────────────────────────
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
        // In-place: overwrite in project root; otherwise write to outputDir
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

  // ── Copy non-AngularJS assets (tsconfig, angular.json template, etc.) ─────
  copyStaticAssets(absPath, scaffoldRoot);

  // ── Generate angular.json scaffold if not present ─────────────────────────
  generateAngularJson(scaffoldRoot, projectName);

  // ── Generate tsconfig.json if not present ────────────────────────────────
  generateTsConfig(scaffoldRoot);

  // ── Build and save report ──────────────────────────────────────────────────
  const reportContent = buildReport({
    repoName: projectName,
    provider: "local",
    branch: "—",
    stats,
    depReport,
    errors,
    outputDir,
  });
  const reportPath = saveReport(outputDir, projectName, reportContent);

  // ── Update analysis file with migration timestamp ─────────────────────────
  if (analysis) {
    analysis.lastMigration = {
      migratedAt: new Date().toISOString(),
      outputDir,
      stats: { success: stats.success, errors: stats.errors },
    };
    saveAnalysis(absPath, analysis);
  }

  // ── Print results ──────────────────────────────────────────────────────────
  ui.section("Resultado da Migração");
  printKeyValue("Total de arquivos:", String(stats.total));
  printKeyValue("Migrados com sucesso:", chalk.green(String(stats.success)));
  printKeyValue("Ignorados:", chalk.dim(String(stats.skipped)));
  printKeyValue(
    "Erros:",
    stats.errors > 0 ? chalk.red(String(stats.errors)) : chalk.dim("0"),
  );

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

  // ── Auto npm install ───────────────────────────────────────────────────────
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

// ── Scaffold helpers ──────────────────────────────────────────────────────────

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
      } catch {
        /* ignore */
      }
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
  } catch {
    /* ignore */
  }
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
  } catch {
    /* ignore */
  }
}