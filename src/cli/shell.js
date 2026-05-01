import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import chalk from "chalk";
import { tokenize } from "./tokenizer.js";
import { dispatch } from "./dispatcher.js";
import { loadConfig } from "../utils/config-manager.js";



const CONFIG_DIR = path.join(os.homedir(), ".ng-migrate");
const HISTORY_FILE = path.join(CONFIG_DIR, ".shell_history");
const MAX_HISTORY = 500;
const QUIET = process.argv.includes("--quiet") || process.argv.includes("-q");



const ALIASES = {
  s: "scan",
  m: "migrate",
  mp: "migrate-project",
  mr: "migrate-repo",
  a: "analyze",
  c: "config",
  cl: "checklist",
  st: "start",
  r: "repl",
  e: "env",
  q: "exit",
};



const SHELL_COMMANDS = [
  "config",
  "scan",
  "migrate",
  "migrate-project",
  "migrate-repo",
  "start",
  "analyze",
  "repl",
  "checklist",
  "env",
  "help",
  "exit",
  "sair",

  ...Object.keys(ALIASES),
];

function shellCompleter(line) {

  const migrateMatch = line.match(/^(migrate|m)\s+(.*)$/);
  if (migrateMatch) {
    const prefix = migrateMatch[1];
    const partial = migrateMatch[2];
    const dir =
      partial.includes("/") || partial.includes("\\")
        ? path.dirname(partial)
        : ".";
    const base = path.basename(partial);
    try {
      const entries = fs.readdirSync(dir);
      const matches = entries
        .filter(
          (f) =>
            f.startsWith(base) &&
            (f.endsWith(".js") || f.endsWith(".ts") || f.endsWith(".html")),
        )
        .map((f) => `${prefix} ${dir === "." ? f : path.join(dir, f)}`);
      return [matches, line];
    } catch {
      return [[], line];
    }
  }

  const hits = SHELL_COMMANDS.filter((c) => c.startsWith(line));
  return [hits.length ? hits : SHELL_COMMANDS, line];
}



function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return fs.readFileSync(HISTORY_FILE, "utf-8").split("\n").filter(Boolean);
    }
  } catch {
     
  }
  return [];
}

function appendHistory(cmd) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const history = loadHistory();

    if (history[history.length - 1] === cmd) return;
    history.push(cmd);
    const trimmed =
      history.length > MAX_HISTORY ? history.slice(-MAX_HISTORY) : history;
    fs.writeFileSync(HISTORY_FILE, trimmed.join("\n") + "\n", "utf-8");
  } catch {
     
  }
}



const PROMPT = chalk.bold.green("> ");

 
function showPrompt(rl) {
  if (!QUIET) {
    process.stdout.write(chalk.dim("  ? for shortcuts\n"));
  }
  rl.setPrompt(PROMPT);
  rl.prompt();
}



function printShortcuts() {
  console.log();
  console.log(chalk.bold.white("  Atalhos de comando"));
  console.log(chalk.dim("  " + "─".repeat(52)));

  const rows = [
    ["config      c", "Configura o provedor de IA"],
    ["scan        s", "Escaneia projeto AngularJS"],
    ["migrate     m", "Migra um único arquivo"],
    ["migrate-project  mp", "Migra projeto completo"],
    ["migrate-repo    mr", "Migra repositório GitHub/GitLab"],
    ["start       st", "Pipeline completo automatizado"],
    ["analyze     a", "Analisa com IA e gera relatório"],
    ["repl        r", "Modo REPL de conversão de código"],
    ["checklist   cl", "Gera checklist de migração"],
    ["env         e", "Gerencia variáveis de ambiente"],
    ["exit        q", "Encerra o shell interativo"],
  ];

  for (const [cmd, desc] of rows) {
    const [full, alias] = cmd.split(/\s{2,}/);
    console.log(
      "  " +
        chalk.cyan(full.padEnd(16)) +
        chalk.dim(alias.padEnd(6)) +
        chalk.dim(desc),
    );
  }

  console.log();
  console.log(
    chalk.dim("  Tab   ") +
      chalk.dim("→ completa comandos e arquivos após 'migrate'"),
  );
  console.log(
    chalk.dim("  ↑ ↓   ") + chalk.dim("→ navega no histórico de comandos"),
  );
  console.log(chalk.dim("  Ctrl+C") + chalk.dim("→ limpa a linha atual"));
  console.log(chalk.dim("  " + "─".repeat(52)));
  console.log();
}



function detectProject() {
  try {
    const analysisFile = path.join(process.cwd(), ".ng-migrate-analysis.json");
    if (fs.existsSync(analysisFile)) {
      const data = JSON.parse(fs.readFileSync(analysisFile, "utf-8"));
      return data.projectName || data.name || path.basename(process.cwd());
    }
  } catch {
     
  }
  return null;
}



function getProviderInfo() {
  try {
    const config = loadConfig();
    const provider = config.activeProvider;
    const model = config.providers?.[provider]?.model || "";
    return { provider, model };
  } catch {
     
  }
  return null;
}



function printShellWelcome() {
  if (QUIET) return;

  const argv1 = process.argv[1] || "";
  const isGlobal =
    !argv1.includes("node_modules/.bin") &&
    (argv1.includes("/bin/") ||
      argv1.includes("\\bin\\") ||
      argv1.endsWith("ng-migrate") ||
      argv1.endsWith("ng-migrate.cmd"));


  const provInfo = getProviderInfo();
  if (provInfo) {
    const label = provInfo.model
      ? `${provInfo.model} via ${provInfo.provider}`
      : provInfo.provider;
    console.log(chalk.dim("  ● ") + chalk.dim(label));
  }


  const project = detectProject();
  if (project) {
    console.log(
      chalk.dim("  ◆ ") + chalk.cyan(project) + chalk.dim(" detectado"),
    );
  }

  console.log(chalk.dim("  " + "─".repeat(40)));
  console.log();

  if (!isGlobal) {
    console.log(
      chalk.yellow("  ! ") +
        chalk.dim("Instale globalmente: ") +
        chalk.cyan("npm install -g ng-migrate-ai"),
    );
    console.log();
  }
}



function resolveAlias(input) {
  const firstWord = input.split(/\s+/)[0];
  if (ALIASES[firstWord]) {
    return input.replace(firstWord, ALIASES[firstWord]);
  }
  return input;
}



 
export async function interactiveShell() {
  printShellWelcome();

  const history = loadHistory();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
    completer: shellCompleter,
    history,
    historySize: MAX_HISTORY,
  });

  showPrompt(rl);


  rl.on("SIGINT", () => {
    process.stdout.write("\r\x1b[2K");
    if (!QUIET) console.log(chalk.dim("  (use 'exit' ou 'q' para sair)"));
    showPrompt(rl);
  });

  rl.on("line", async (input) => {
    const trimmed = input.trim();

    if (!trimmed) {
      showPrompt(rl);
      return;
    }


    if (["?", "help", "ajuda", "h"].includes(trimmed.toLowerCase())) {
      printShortcuts();
      showPrompt(rl);
      return;
    }


    const resolved = resolveAlias(trimmed);


    if (
      ["exit", "quit", "sair"].includes(resolved.split(/\s+/)[0].toLowerCase())
    ) {
      appendHistory(trimmed);
      console.log();
      if (!QUIET) {
        console.log(chalk.dim("  " + "─".repeat(40)));
        console.log(chalk.green("  ✔ ") + chalk.dim("Até logo!"));
        console.log();
      }
      rl.close();
      process.exit(0);
    }


    appendHistory(trimmed);


    if (!QUIET) {
      console.log();
      console.log(chalk.dim("  " + "─".repeat(40)));
      console.log();
    }


    const t0 = Date.now();
    rl.pause();

    try {
      await dispatch(tokenize(resolved), rl);
    } catch (err) {
      console.log();
      console.log(chalk.red("  ✖ ") + chalk.red(err?.message || String(err)));
    }

    if (!QUIET) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(2);
      console.log();
      console.log(chalk.dim("  " + "─".repeat(40)));
      console.log(chalk.dim(`  concluído em ${elapsed}s`));
      console.log();
    }

    rl.resume();
    showPrompt(rl);
  });

  rl.on("close", () => {
    console.log();
    process.exit(0);
  });
}


export { showInteractiveHelp } from "./dispatcher.js";
