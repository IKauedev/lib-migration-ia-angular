/**
 * watch.js
 * Comando `ng-migrate watch [pasta]` — monitora arquivos AngularJS e migra automaticamente ao salvar.
 * Usa chokidar para file watching; migra com a IA e aplica post-cleanup.
 */

import path from "path";
import fs from "fs";
import chalk from "chalk";
import { loadConfig } from "../utils/config-manager.js";
import { migrateWithAI } from "../utils/ai.js";
import { applyPostCleanup } from "../utils/post-cleanup.js";
import {
  loadPlugin,
  applyPluginRules,
  runPluginPostProcess,
  shouldSkipFile,
} from "../utils/plugin-loader.js";
import { dbg } from "../utils/debug.js";

// Padrões de arquivos AngularJS reconhecíveis
const ANGULARJS_PATTERNS = [
  /angular\.module\s*\(/,
  /\.controller\s*\(/,
  /\.service\s*\(/,
  /\.factory\s*\(/,
  /\.filter\s*\(/,
  /\.directive\s*\(/,
  /\$scope\b/,
  /\$http\b/,
  /\$routeProvider\b/,
  /\$stateProvider\b/,
];

/**
 * Verifica se um arquivo parece ser AngularJS.
 * @param {string} code
 * @returns {boolean}
 */
function isAngularJsFile(code) {
  return ANGULARJS_PATTERNS.some((p) => p.test(code));
}

/**
 * Determina o arquivo de saída (.ts) para um arquivo .js AngularJS.
 * @param {string} filePath
 * @param {string} watchDir
 * @param {string} outDir
 * @returns {string}
 */
function resolveOutputPath(filePath, watchDir, outDir) {
  const rel = path.relative(watchDir, filePath);
  const tsRel = rel.replace(/\.js$/, ".ts");
  return path.join(outDir, tsRel);
}

/**
 * Migra um único arquivo e escreve na saída.
 * @param {string} filePath - Caminho absoluto do arquivo alterado
 * @param {object} opts - Opções do watch
 * @param {string} opts.watchDir - Pasta sendo monitorada
 * @param {string} opts.outDir - Pasta de saída
 * @param {object} opts.config - Configuração de IA
 * @param {object|null} opts.plugin - Plugin carregado
 */
async function migrateFile(filePath, opts) {
  const rel = path.relative(opts.watchDir, filePath);
  const prefix = chalk.cyan(`[watch]`);

  if (shouldSkipFile(rel, opts.plugin)) {
    console.log(`${prefix} ${chalk.dim("Pulado (regra do plugin):")} ${rel}`);
    return;
  }

  let code;
  try {
    code = fs.readFileSync(filePath, "utf8");
  } catch {
    console.log(
      `${prefix} ${chalk.dim("Arquivo não encontrado — ignorado:")} ${rel}`,
    );
    return;
  }

  if (!isAngularJsFile(code)) {
    dbg(`[watch] Arquivo não parece ser AngularJS, ignorando: ${rel}`);
    return;
  }

  const start = Date.now();
  process.stdout.write(`${prefix} ${chalk.yellow("Migrando:")} ${rel} ...`);

  try {
    const raw = await migrateWithAI(
      code,
      path.basename(filePath),
      opts.config,
      {
        filename: rel,
      },
    );

    // Extrair código migrado da resposta
    let migratedCode = raw;
    const codeMatch = raw.match(/```(?:typescript|ts)?\n([\s\S]+?)\n```/);
    if (codeMatch) {
      migratedCode = codeMatch[1];
    }

    // Post-cleanup e plugin rules
    const { code: cleaned } = applyPostCleanup(migratedCode, rel);
    let finalCode = applyPluginRules(cleaned, opts.plugin, rel);
    finalCode = await runPluginPostProcess(finalCode, opts.plugin, rel);

    // Escrever arquivo de saída
    const outPath = resolveOutputPath(filePath, opts.watchDir, opts.outDir);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, finalCode, "utf8");

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(
      ` ${chalk.green("✓")} ${chalk.dim(`${elapsed}s → ${path.relative(process.cwd(), outPath)}`)}\n`,
    );
  } catch (err) {
    process.stdout.write(` ${chalk.red("✗")}\n`);
    console.error(`${prefix} ${chalk.red("Erro:")} ${err.message}`);
    dbg(`[watch] Stack: ${err.stack}`);
  }
}

/**
 * Comando principal do watch.
 *
 * @param {string} watchPath - Pasta a monitorar (padrão: .)
 * @param {object} opts - Opções do Commander
 * @param {string} [opts.out] - Pasta de saída dos arquivos migrados
 * @param {string} [opts.only] - Extensões a monitorar (padrão: .js)
 * @param {boolean} [opts.dryRun] - Não escreve arquivos, apenas loga
 */
export async function watchCommand(watchPath, opts = {}) {
  // Importação dinâmica de chokidar (dependência opcional)
  let chokidar;
  try {
    chokidar = (await import("chokidar")).default;
  } catch {
    console.error(
      chalk.red(
        "Erro: chokidar não está instalado. Execute: npm install chokidar",
      ),
    );
    process.exit(1);
  }

  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(chalk.red(`Erro ao carregar configuração: ${err.message}`));
    console.error(chalk.dim("Execute: ng-migrate config"));
    process.exit(1);
  }

  const watchDir = path.resolve(watchPath || ".");
  const outDir = path.resolve(
    opts.out || path.join(watchDir, "migrated-angular21"),
  );
  const ext = opts.only || ".js";

  // Carrega plugin do projeto monitorado
  const plugin = await loadPlugin(watchDir);

  console.log();
  console.log(chalk.bold.cyan("ng-migrate watch"));
  console.log(chalk.dim(`  Monitorando: ${watchDir}`));
  console.log(chalk.dim(`  Saída:       ${outDir}`));
  console.log(chalk.dim(`  Extensão:    *${ext}`));
  if (plugin) console.log(chalk.dim(`  Plugin:      carregado`));
  console.log();
  console.log(chalk.dim("Pressione Ctrl+C para parar.\n"));

  const migrateQueue = new Map(); // path → debounce timer

  const watcher = chokidar.watch(`${watchDir}/**/*${ext}`, {
    ignored: [
      /(^|[/\\])\../, // arquivos ocultos
      /node_modules/,
      /\.spec\.js$/,
      outDir,
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const handleChange = (filePath) => {
    // Debounce de 500ms para evitar múltiplas chamadas em salvamentos rápidos
    if (migrateQueue.has(filePath)) {
      clearTimeout(migrateQueue.get(filePath));
    }
    const timer = setTimeout(async () => {
      migrateQueue.delete(filePath);
      if (!opts.dryRun) {
        await migrateFile(filePath, { watchDir, outDir, config, plugin });
      } else {
        const rel = path.relative(watchDir, filePath);
        console.log(
          chalk.cyan(`[watch dry-run]`) +
            ` ${rel} alterado — migração não aplicada.`,
        );
      }
    }, 500);
    migrateQueue.set(filePath, timer);
  };

  watcher.on("change", handleChange);
  watcher.on("add", handleChange);

  watcher.on("error", (err) => {
    console.error(chalk.red(`[watch] Erro: ${err.message}`));
  });

  // Manter processo ativo
  process.on("SIGINT", () => {
    console.log(chalk.dim("\n[watch] Parando monitoramento..."));
    watcher.close();
    process.exit(0);
  });
}
