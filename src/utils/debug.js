import chalk from "chalk";

const PREFIX = chalk.gray("  [debug]");

// ── Activation ────────────────────────────────────────────────────────────────

export function isDebug() {
  return process.env.NG_MIGRATE_DEBUG === "1";
}

/**
 * Sets NG_MIGRATE_DEBUG and prints the activation banner.
 * Call this from the CLI preAction hook when --debug is passed.
 */
export function activateDebug() {
  process.env.NG_MIGRATE_DEBUG = "1";
  console.log(
    `${PREFIX} 🐛 ${chalk.bold("modo debug ativado")} — exibindo operações detalhadas\n`,
  );
}

// ── Generic log ───────────────────────────────────────────────────────────────

export function dbg(msg) {
  if (isDebug()) console.log(`${PREFIX} ${msg}`);
}

// ── File operations ───────────────────────────────────────────────────────────

const FILE_ICONS = {
  lendo: "📄",
  escrevendo: "💾",
  backup: "🗂️",
  skip: "⏭️",
  criando: "🆕",
  deletando: "🗑️",
  copiando: "📋",
};

/**
 * @param {"lendo"|"escrevendo"|"backup"|"skip"|"criando"|"deletando"|"copiando"} action
 * @param {string} filePath
 * @param {string} [detail]
 */
export function dbgFile(action, filePath, detail = "") {
  if (!isDebug()) return;
  const icon = FILE_ICONS[action] ?? "📌";
  const d = detail ? chalk.dim(` ${detail}`) : "";
  console.log(
    `${PREFIX} ${icon} ${chalk.bold(action)}: ${chalk.cyan(filePath)}${d}`,
  );
}

// ── AI operations ─────────────────────────────────────────────────────────────

const AI_ICONS = { enviando: "🤖", resposta: "✅", erro: "❌", modelo: "⚙️" };

/**
 * @param {"enviando"|"resposta"|"erro"|"modelo"} action
 * @param {string} context  e.g. model name or file being processed
 * @param {string} [detail]
 */
export function dbgAI(action, context, detail = "") {
  if (!isDebug()) return;
  const icon = AI_ICONS[action] ?? "◈";
  const d = detail ? chalk.dim(` | ${detail}`) : "";
  console.log(
    `${PREFIX} ${icon} IA ${chalk.bold(action)}: ${chalk.magenta(context)}${d}`,
  );
}

// ── Directory / scaffold operations ───────────────────────────────────────────

const DIR_ICONS = {
  criando: "📁",
  scaffolding: "🏗️",
  backup: "🗂️",
  limpando: "🧹",
};

/**
 * @param {"criando"|"scaffolding"|"backup"|"limpando"} action
 * @param {string} dirPath
 * @param {string} [detail]
 */
export function dbgDir(action, dirPath, detail = "") {
  if (!isDebug()) return;
  const icon = DIR_ICONS[action] ?? "📁";
  const d = detail ? chalk.dim(` ${detail}`) : "";
  console.log(
    `${PREFIX} ${icon} dir ${chalk.bold(action)}: ${chalk.yellow(dirPath)}${d}`,
  );
}

// ── Phase / pipeline ──────────────────────────────────────────────────────────

export function dbgPhase(phase, name, count) {
  if (!isDebug()) return;
  console.log(
    `${PREFIX} 🔄 iniciando fase ${chalk.bold(String(phase))}: ${chalk.white(name)} ${chalk.dim(`(${count} arquivo(s))`)}`,
  );
}

export function dbgStep(msg) {
  if (!isDebug()) return;
  console.log(`${PREFIX} ⚡ ${chalk.bold(msg)}`);
}

// ── Scan ──────────────────────────────────────────────────────────────────────

export function dbgScan(filePath, patterns, complexity) {
  if (!isDebug()) return;
  const patStr = patterns?.length
    ? chalk.dim(
        patterns.slice(0, 3).join(", ") +
          (patterns.length > 3 ? ` +${patterns.length - 3}` : ""),
      )
    : chalk.dim("sem padrões");
  const cc =
    { alta: chalk.red, média: chalk.yellow, baixa: chalk.green }[complexity] ??
    chalk.white;
  console.log(
    `${PREFIX} 🔍 scan: ${chalk.cyan(filePath)} — ${cc(complexity ?? "?")} | ${patStr}`,
  );
}
