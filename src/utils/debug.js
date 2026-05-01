import chalk from "chalk";

const PREFIX = chalk.gray("  [debug]");



export function isDebug() {
  return process.env.NG_MIGRATE_DEBUG === "1";
}

 
export function activateDebug() {
  process.env.NG_MIGRATE_DEBUG = "1";
  console.log(
    `${PREFIX} 🐛 ${chalk.bold("modo debug ativado")} — exibindo operações detalhadas\n`,
  );
}



export function dbg(msg) {
  if (isDebug()) console.log(`${PREFIX} ${msg}`);
}



const FILE_ICONS = {
  lendo: "📄",
  escrevendo: "💾",
  backup: "🗂️",
  skip: "⏭️",
  criando: "🆕",
  deletando: "🗑️",
  copiando: "📋",
};

 
export function dbgFile(action, filePath, detail = "") {
  if (!isDebug()) return;
  const icon = FILE_ICONS[action] ?? "📌";
  const d = detail ? chalk.dim(` ${detail}`) : "";
  console.log(
    `${PREFIX} ${icon} ${chalk.bold(action)}: ${chalk.cyan(filePath)}${d}`,
  );
}



const AI_ICONS = { enviando: "🤖", resposta: "✅", erro: "❌", modelo: "⚙️" };

 
export function dbgAI(action, context, detail = "") {
  if (!isDebug()) return;
  const icon = AI_ICONS[action] ?? "◈";
  const d = detail ? chalk.dim(` | ${detail}`) : "";
  console.log(
    `${PREFIX} ${icon} IA ${chalk.bold(action)}: ${chalk.magenta(context)}${d}`,
  );
}



const DIR_ICONS = {
  criando: "📁",
  scaffolding: "🏗️",
  backup: "🗂️",
  limpando: "🧹",
};

 
export function dbgDir(action, dirPath, detail = "") {
  if (!isDebug()) return;
  const icon = DIR_ICONS[action] ?? "📁";
  const d = detail ? chalk.dim(` ${detail}`) : "";
  console.log(
    `${PREFIX} ${icon} dir ${chalk.bold(action)}: ${chalk.yellow(dirPath)}${d}`,
  );
}



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
