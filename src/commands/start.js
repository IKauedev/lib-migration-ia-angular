import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { scanProject, saveAnalysis } from "../utils/project-scanner.js";
import { migrateProjectCommand } from "./migrate-project.js";
import { loadConfig } from "../utils/config-manager.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";
import { dbg, dbgStep, dbgScan } from "../utils/debug.js";



const PHASE_NAMES = {
  1: "Services & Factories",
  2: "Filters → Pipes",
  3: "Directives & Components",
  4: "Controllers",
  5: "Templates",
  6: "Roteamento",
};



export async function startCommand(projectPath, opts) {
  const { default: inquirer } = await import("inquirer");

  const absPath = path.resolve(projectPath || ".");


  if (!fs.existsSync(absPath) || !fs.lstatSync(absPath).isDirectory()) {
    ui.error(`Pasta não encontrada: ${absPath}`);
    process.exit(1);
  }


  const config = loadConfig();
  const activeCfg = config.providers[config.activeProvider];
  dbgStep(
    `provedor ativo: ${config.activeProvider} | modelo: ${activeCfg?.model || "(padrão)"}`,
  );
  if (!activeCfg?.apiKey) {
    ui.blank();
    ui.warn("Nenhum provedor de IA configurado.");
    console.log(
      chalk.dim(
        "  Configure uma API key antes de continuar:\n" +
          chalk.cyan("    ng-migrate config\n"),
      ),
    );
    process.exit(1);
  }

  ui.section("Pipeline de Migração Automática");
  console.log(
    chalk.dim(
      "  Este comando escaneia o projeto, planeja e executa a migração\n" +
        "  completa de AngularJS → Angular 21 de forma automatizada.\n",
    ),
  );
  printKeyValue("Projeto:", absPath);
  printKeyValue(
    "Provedor de IA:",
    chalk.cyan(config.activeProvider) +
      chalk.dim(` (${activeCfg.model || "modelo padrão"})`),
  );
  ui.blank();


  const scanSpinner = ora(
    chalk.dim("Fase 1/4 — Escaneando projeto..."),
  ).start();
  let analysis;
  try {
    analysis = await scanProject(absPath);
    scanSpinner.succeed(
      chalk.green(
        `Escaneamento concluído — ${chalk.cyan(analysis.summary.angularJsFiles)} arquivo(s) AngularJS detectados`,
      ),
    );
    if (analysis.files?.length) {
      for (const f of analysis.files) {
        dbgScan(f.path, f.patterns, f.complexity);
      }
    }
    dbgStep(
      `análise: ${analysis.summary.angularJsFiles} AngularJS | ${analysis.summary.totalFiles} total | complexidade=${analysis.summary.overallComplexity}`,
    );
  } catch (err) {
    scanSpinner.fail(chalk.red("Erro no escaneamento: " + err.message));
    process.exit(1);
  }

  if (analysis.summary.angularJsFiles === 0) {
    ui.blank();
    ui.warn(
      "Nenhum padrão AngularJS detectado nesta pasta. Tem certeza que é um projeto AngularJS?",
    );
    const { force } = await inquirer.prompt([
      {
        type: "confirm",
        name: "force",
        message: "Continuar mesmo assim?",
        default: false,
      },
    ]);
    if (!force) process.exit(0);
  }


  ui.blank();
  ui.section("Fase 2/4 — Plano de Migração");

  const s = analysis.summary;
  printKeyValue("Total de arquivos:", String(s.totalFiles ?? "—"));
  printKeyValue(
    "Arquivos AngularJS:",
    chalk.cyan(String(s.angularJsFiles ?? "—")),
  );
  printKeyValue(
    "Complexidade geral:",
    complexityBadge(s.overallComplexity ?? ""),
  );
  printKeyValue(
    "Tempo estimado:",
    s.estimatedHours != null ? chalk.yellow(`~${s.estimatedHours}h`) : "—",
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

  if (analysis.migrationPlan?.phases?.length) {
    ui.blank();
    console.log(chalk.bold("  Fases de migração:"));
    for (const phase of analysis.migrationPlan.phases) {
      const name = PHASE_NAMES[phase.phase] || `Fase ${phase.phase}`;
      console.log(
        chalk.dim(`    Fase ${phase.phase}: `) +
          chalk.white(name) +
          chalk.dim(` (${phase.files?.length ?? 0} arquivo(s))`),
      );
    }
  }


  if (analysis.summary.topPatterns?.length) {
    ui.blank();
    console.log(chalk.bold("  Padrões AngularJS detectados:"));
    for (const p of analysis.summary.topPatterns.slice(0, 6)) {
      console.log(
        chalk.red("    ✖ ") +
          chalk.dim(`${p.name}`) +
          chalk.dim(` (${p.count} ocorrência(s))`),
      );
    }
  }

  ui.blank();


  ui.section("Fase 3/4 — Configuração");

  const { outputMode } = await inquirer.prompt([
    {
      type: "list",
      name: "outputMode",
      message: "Onde gerar o projeto Angular 21 migrado?",
      choices: [
        {
          name: `${chalk.cyan("In-place")} — cria ${chalk.dim("src-angular21/")} dentro deste projeto (recomendado)`,
          value: "inplace",
        },
        {
          name: `${chalk.cyan("Nova pasta")} — cria ${chalk.dim(path.basename(absPath) + "-angular21/")} ao lado deste projeto`,
          value: "sibling",
        },
      ],
    },
  ]);

  const { concurrency } = await inquirer.prompt([
    {
      type: "list",
      name: "concurrency",
      message: "Quantos arquivos migrar em paralelo?",
      choices: [
        { name: "1 — mais lento, menor custo de tokens", value: "1" },
        { name: "3 — balanceado (recomendado)", value: "3" },
        { name: "5 — mais rápido, maior custo de tokens", value: "5" },
        { name: "10 — máximo", value: "10" },
      ],
      default: "3",
    },
  ]);

  const { skipDeps } = await inquirer.prompt([
    {
      type: "confirm",
      name: "skipDeps",
      message:
        "Atualizar package.json automaticamente (troca deps AngularJS por Angular 21)?",
      default: true,
    },
  ]);

  const { skipInstall } = await inquirer.prompt([
    {
      type: "confirm",
      name: "skipInstall",
      message: "Executar npm install ao final?",
      default: true,
    },
  ]);

  ui.blank();


  const outputPreview =
    outputMode === "inplace"
      ? path.join(absPath, "src-angular21")
      : path.join(path.dirname(absPath), `${path.basename(absPath)}-angular21`);

  console.log(chalk.bold("  Resumo do que será feito:"));
  console.log(
    chalk.green("  ✔ ") +
      "Escanear e salvar análise em .ng-migrate-analysis.json",
  );
  console.log(chalk.green("  ✔ ") + "Criar projeto Angular 21 via ng new");
  console.log(
    chalk.green("  ✔ ") +
      `Converter ${s.angularJsFiles} arquivo(s) de AngularJS → Angular 21`,
  );
  if (!skipDeps) console.log(chalk.green("  ✔ ") + "Atualizar package.json");
  if (!skipInstall) console.log(chalk.green("  ✔ ") + "Executar npm install");
  console.log(chalk.dim(`\n  Destino: ${outputPreview}`));
  console.log(
    chalk.dim(
      outputMode === "inplace"
        ? `  Backup dos originais: ${path.join(absPath, "src-angularjs-backup")}`
        : "",
    ),
  );
  ui.blank();

  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message: chalk.bold("Iniciar migração completa agora?"),
      default: true,
    },
  ]);

  if (!confirmed) {
    ui.blank();
    ui.info("Migração cancelada. Você pode executar manualmente:");
    console.log(
      chalk.cyan(
        `    ng-migrate migrate-project ${outputMode === "inplace" ? "--in-place" : ""} -c ${concurrency}\n`,
      ),
    );
    process.exit(0);
  }


  try {
    saveAnalysis(absPath, analysis);
    dbgStep("análise salva em .ng-migrate-analysis.json");
  } catch {

  }


  ui.blank();
  ui.section("Fase 4/4 — Migração em andamento");

  const migrateOpts = {
    inPlace: outputMode === "inplace",
    output: outputMode === "sibling" ? outputPreview : undefined,
    concurrency,
    skipDeps: !skipDeps,
    skipInstall: !skipInstall,
    dryRun: false,
    only: opts.only,
    phase: opts.phase,
    clone: undefined,
  };

  dbgStep(`delegando para migrate-project | ${JSON.stringify(migrateOpts)}`);
  await migrateProjectCommand(absPath, migrateOpts);
}



function complexityBadge(c) {
  if (c === "alta") return chalk.red("alta");
  if (c === "média") return chalk.yellow("média");
  if (c === "baixa") return chalk.green("baixa");
  return chalk.dim(c || "—");
}
