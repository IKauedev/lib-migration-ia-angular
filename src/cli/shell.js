/**
 * Interactive shell — persistent readline loop (Open Claude style).
 * Stays running after each command, prompting for the next.
 *
 * Features:
 *  - Persistent history across sessions (~/.ng-migrate/.shell_history)
 *  - ↑↓ history navigation built into readline
 *  - Command aliases (s=scan, m=migrate, mp=migrate-project, …)
 *  - Active provider/model shown in welcome header
 *  - Detected AngularJS project shown in welcome header
 *  - ? or help shows a compact shortcuts panel
 *  - Ctrl+C clears the current line without exiting
 *  - Tab-completes commands AND .js/.ts/.html files after "migrate"
 *  - --quiet / -q mode suppresses all decorative output
 */

import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import chalk from "chalk";
import { tokenize } from "./tokenizer.js";
import { dispatch } from "./dispatcher.js";
import { loadConfig } from "../utils/config-manager.js";

// ── Config ────────────────────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), ".ng-migrate");
const HISTORY_FILE = path.join(CONFIG_DIR, ".shell_history");
const MAX_HISTORY = 500;
const QUIET = process.argv.includes("--quiet") || process.argv.includes("-q");

// ── Aliases ───────────────────────────────────────────────────────────────────

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

// ── Tab-completion ────────────────────────────────────────────────────────────

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
  // aliases
  ...Object.keys(ALIASES),
];

function shellCompleter(line) {
  // After "migrate <partial>" or "m <partial>" → suggest matching JS/TS/HTML files
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

// ── Persistent history ────────────────────────────────────────────────────────

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return fs.readFileSync(HISTORY_FILE, "utf-8").split("\n").filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function appendHistory(cmd) {
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    const history = loadHistory();
    // Avoid consecutive duplicates
    if (history[history.length - 1] === cmd) return;
    history.push(cmd);
    const trimmed =
      history.length > MAX_HISTORY ? history.slice(-MAX_HISTORY) : history;
    fs.writeFileSync(HISTORY_FILE, trimmed.join("\n") + "\n", "utf-8");
  } catch {
    /* ignore */
  }
}

// ── Prompt ────────────────────────────────────────────────────────────────────

const PROMPT = chalk.bold.green("> ");

/**
 * Renders the hint line then the "> " prompt below it.
 * Hint is printed as a plain line above the input — no ANSI cursor tricks
 * that could conflict with readline's own cursor management.
 */
function showPrompt(rl) {
  if (!QUIET) {
    process.stdout.write(chalk.dim("  ? for shortcuts\n"));
  }
  rl.setPrompt(PROMPT);
  rl.prompt();
}

// ── Shortcuts panel ───────────────────────────────────────────────────────────

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

// ── Detect local AngularJS project ────────────────────────────────────────────

function detectProject() {
  try {
    const analysisFile = path.join(process.cwd(), ".ng-migrate-analysis.json");
    if (fs.existsSync(analysisFile)) {
      const data = JSON.parse(fs.readFileSync(analysisFile, "utf-8"));
      return data.projectName || data.name || path.basename(process.cwd());
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ── Active provider info ──────────────────────────────────────────────────────

function getProviderInfo() {
  try {
    const config = loadConfig();
    const provider = config.activeProvider;
    const model = config.providers?.[provider]?.model || "";
    return { provider, model };
  } catch {
    /* ignore */
  }
  return null;
}

// ── Welcome message ───────────────────────────────────────────────────────────

function printShellWelcome() {
  if (QUIET) return;

  const argv1 = process.argv[1] || "";
  const isGlobal =
    !argv1.includes("node_modules/.bin") &&
    (argv1.includes("/bin/") ||
      argv1.includes("\\bin\\") ||
      argv1.endsWith("ng-migrate") ||
      argv1.endsWith("ng-migrate.cmd"));

  // Active provider / model
  const provInfo = getProviderInfo();
  if (provInfo) {
    const label = provInfo.model
      ? `${provInfo.model} via ${provInfo.provider}`
      : provInfo.provider;
    console.log(chalk.dim("  ● ") + chalk.dim(label));
  }

  // Detected project
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

// ── Resolve alias ─────────────────────────────────────────────────────────────

function resolveAlias(input) {
  const firstWord = input.split(/\s+/)[0];
  if (ALIASES[firstWord]) {
    return input.replace(firstWord, ALIASES[firstWord]);
  }
  return input;
}

// ── Main shell loop ───────────────────────────────────────────────────────────

/**
 * Starts the persistent interactive shell.
 * Exits only on "exit" / "sair" / Ctrl+D.
 * Ctrl+C clears the current input line without exiting.
 */
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

  // Ctrl+C → clear line, do NOT exit
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

    // ── Shortcuts panel ───────────────────────────────────────────────────────
    if (["?", "help", "ajuda", "h"].includes(trimmed.toLowerCase())) {
      printShortcuts();
      showPrompt(rl);
      return;
    }

    // ── Resolve alias ─────────────────────────────────────────────────────────
    const resolved = resolveAlias(trimmed);

    // ── Exit ──────────────────────────────────────────────────────────────────
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

    // ── Save to history ───────────────────────────────────────────────────────
    appendHistory(trimmed);

    // ── Command separator ─────────────────────────────────────────────────────
    if (!QUIET) {
      console.log();
      console.log(chalk.dim("  " + "─".repeat(40)));
      console.log();
    }

    // ── Execute ───────────────────────────────────────────────────────────────
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

// Re-export for use in Commander's default action
export { showInteractiveHelp } from "./dispatcher.js";
