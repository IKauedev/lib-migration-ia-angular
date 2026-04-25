import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import cliProgress from "cli-progress";
import { analyzeWithAI } from "../utils/ai.js";
import { parseAnalyzeResponse } from "../utils/parser.js";
import {
  scanProject,
  saveAnalysis,
  loadAnalysis,
  ANALYSIS_FILE_NAME,
} from "../utils/project-scanner.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";

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

    const bar = new cliProgress.SingleBar(
      {
        format: chalk.dim(
          "  {bar} {percentage}% | {value}/{total} | {filename}",
        ),
        barCompleteChar: "█",
        barIncompleteChar: "░",
        hideCursor: true,
      },
      cliProgress.Presets.shades_classic,
    );

    bar.start(analysis.files.length, 0, { filename: "" });
    let done = 0;

    for (const fileInfo of analysis.files) {
      bar.update(done, { filename: fileInfo.path });
      try {
        const absFilePath = path.join(absPath, fileInfo.path);
        const code = fs.readFileSync(absFilePath, "utf-8");
        const raw = await analyzeWithAI(code, fileInfo.path);
        const ai = parseAnalyzeResponse(raw);

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

        // AI complexity overrides static estimate
        if (ai.complexidade) fileInfo.complexity = ai.complexidade;
      } catch {
        fileInfo.aiAnalysis = { error: "Análise AI falhou para este arquivo" };
      }
      done++;
      bar.update(done, { filename: fileInfo.path });
    }

    bar.stop();
    analysis.summary.aiAnalysisEnabled = true;
    ui.success("Análise AI concluída");
  }

  printSummary(analysis);

  if (!opts.noSave) {
    const saved = saveAnalysis(absPath, analysis);
    ui.blank();
    ui.success(`Análise salva em:          ${chalk.cyan(saved.analysisFile)}`);
    ui.success(`Registro de símbolos:      ${chalk.cyan(saved.registryFile)}`);
    ui.success(`Grafo de dependências:     ${chalk.cyan(saved.graphFile)}`);

    // Registry summary
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
