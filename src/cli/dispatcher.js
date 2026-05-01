import chalk from "chalk";
import { parseOpts } from "./tokenizer.js";
import { migrationWizard } from "./wizard.js";
import { assertReadyToMigrate } from "../utils/config-manager.js";

import { migrateCommand } from "../commands/migrate.js";
import { analyzeCommand } from "../commands/analyze.js";
import { replCommand } from "../commands/repl.js";
import { checklistCommand } from "../commands/checklist.js";
import { migrateRepoCommand } from "../commands/migrate-repo.js";
import { migrateProjectCommand } from "../commands/migrate-project.js";
import { startCommand } from "../commands/start.js";
import { scanCommand } from "../commands/scan.js";
import { configCommand } from "../commands/config.js";
import { envCommand } from "../commands/env.js";



export function showInteractiveHelp() {
  console.log();
  console.log(chalk.bold.white("  Comandos disponíveis:"));
  console.log();

  const cmds = [
    ["config", "Configura o provedor de IA"],
    ["scan [pasta]", "Escaneia projeto AngularJS"],
    ["migrate <arquivo>", "Migra um único arquivo"],
    ["migrate-project [pasta]", "Migra projeto completo"],
    ["migrate-repo <repo>", "Migra repositório GitHub/GitLab"],
    ["start [pasta]", "Pipeline completo automatizado"],
    ["analyze <arquivo>", "Analisa com IA e gera relatório"],
    ["repl", "Modo REPL de conversão de código"],
    ["checklist", "Gera checklist de migração"],
    ["env", "Gerencia variáveis de ambiente"],
    ["exit / sair", "Encerra o shell interativo"],
  ];

  for (const [cmd, desc] of cmds) {
    console.log("  " + chalk.cyan(cmd.padEnd(30)) + chalk.dim(desc));
  }

  console.log();
  console.log(
    chalk.dim("  Use --help após qualquer comando para ver suas opções."),
  );
  console.log();
}



 
function preflightCheck() {
  const result = assertReadyToMigrate();
  if (result.ok) {
    console.log(
      chalk.green("  ✔ ") +
        chalk.dim("Provedor: ") +
        chalk.cyan(result.summary),
    );
    console.log();
    return true;
  }
  console.log();
  console.log(
    chalk.red.bold("  ✖ Configuração incompleta — migração cancelada"),
  );
  console.log();
  for (const err of result.errors) {
    console.log(chalk.red("    · ") + chalk.yellow(err));
  }
  console.log();
  console.log(
    chalk.dim("  Execute ") +
      chalk.cyan("config") +
      chalk.dim(" para configurar o provedor de IA."),
  );
  console.log();
  return false;
}



 
export async function dispatch(tokens, rl) {
  if (!tokens.length) return;

  const [cmd, ...rest] = tokens;
  const { args, opts } = parseOpts(rest);

  switch (cmd.toLowerCase()) {
    case "config":
      await configCommand({
        show: opts["show"] || false,
        reset: opts["reset"] || false,
        taskModel: opts["task-model"] || false,
      });
      break;

    case "scan":
    case "escanear":
      await scanCommand(args[0], {
        ai: opts["ai"] || false,
        force: opts["force"] || false,
        save: opts["save"] !== false,
        includeAll: opts["include-all"] || false,
        json: opts["json"] || false,
      });
      break;

    case "migrate":
      if (!args[0]) {
        console.log(
          chalk.yellow("  ⚠ ") +
            chalk.yellow("Informe o arquivo: migrate <arquivo>"),
        );
        break;
      }
      if (!preflightCheck()) break;
      await migrateCommand(args[0], {
        output: opts["output"] || opts["o"],
        tipo: opts["tipo"] || opts["t"] || "auto",
        dryRun: opts["dry-run"] || false,
        showDiff: opts["show-diff"] || false,
      });
      break;

    case "start":
    case "iniciar": {
      if (!preflightCheck()) break;
      const w = await migrationWizard(rl, "start");
      if (!w.confirmed) break;
      await startCommand(args[0] || w.sourcePath, {
        only: opts["only"],
        phase: opts["phase"],
      });
      break;
    }

    case "migrate-project":
    case "migrar-projeto": {
      if (!preflightCheck()) break;
      const w = await migrationWizard(rl, "migrate-project");
      if (!w.confirmed) break;
      await migrateProjectCommand(args[0] || w.sourcePath, {
        clone: opts["clone"],
        output: opts["output"] || opts["o"] || w.outputPath,
        inPlace: opts["in-place"] || false,
        concurrency: opts["concurrency"] || opts["c"] || "3",
        dryRun: opts["dry-run"] || false,
        only: opts["only"],
        phase: opts["phase"],
        skipDeps: opts["skip-deps"] || false,
        skipInstall: opts["skip-install"] || false,
      });
      break;
    }

    case "migrate-repo":
      if (!args[0]) {
        console.log(
          chalk.yellow("  ⚠ ") +
            chalk.yellow("Informe o repo: migrate-repo <repo>"),
        );
        break;
      }
      if (!preflightCheck()) break;
      await migrateRepoCommand(args[0], {
        githubToken: opts["github-token"],
        gitlabToken: opts["gitlab-token"],
        gitlabUrl: opts["gitlab-url"] || "https://gitlab.com",
        branch: opts["branch"] || opts["b"],
        output: opts["output"] || opts["o"],
        concurrency: opts["concurrency"] || "3",
        dryRun: opts["dry-run"] || false,
        only: opts["only"],
        skipDeps: opts["skip-deps"] || false,
        createPr: opts["create-pr"] || false,
      });
      break;

    case "analyze":
    case "analisar":
      if (!args[0]) {
        console.log(
          chalk.yellow("  ⚠ ") +
            chalk.yellow("Informe o arquivo/pasta: analyze <alvo>"),
        );
        break;
      }
      await analyzeCommand(args[0], { json: opts["json"] || false });
      break;

    case "repl":
      await replCommand();
      break;

    case "checklist":
      await checklistCommand({ projeto: opts["projeto"] || opts["p"] || "." });
      break;

    case "env":
      await envCommand(args[0], args.slice(1), opts);
      break;

    case "help":
    case "--help":
    case "-h":
    case "ajuda":
      showInteractiveHelp();
      break;

    default:
      console.log();
      console.log(
        chalk.yellow("  ⚠ ") + chalk.yellow(`Comando desconhecido: "${cmd}"`),
      );
      console.log(
        chalk.dim("  Digite ") +
          chalk.cyan("help") +
          chalk.dim(" para ver os comandos disponíveis."),
      );
      console.log();
  }
}
