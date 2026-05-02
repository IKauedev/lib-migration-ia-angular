/**
 * generate-tests.js
 * Comando para gerar ou migrar arquivos de testes unitários.
 *
 * Modos:
 *  1. --from-spec  : Migra spec files AngularJS existentes para Angular/Jest
 *  2. --generate   : Gera novos testes para arquivos Angular já migrados
 *  3. Sem flag     : Detecta automaticamente (spec files → migra, outros → gera)
 */

import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import cliProgress from "cli-progress";
import pLimit from "p-limit";
import { glob } from "glob";
import { generateTestsWithAI, migrateSpecWithAI } from "../utils/ai.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";
import { isDebug, dbg, dbgFile } from "../utils/debug.js";

const DEFAULT_CONCURRENCY = 2;

export async function generateTestsCommand(targetPath, opts) {
  const absPath = path.resolve(targetPath || ".");

  if (!fs.existsSync(absPath)) {
    ui.error(`Caminho não encontrado: ${absPath}`);
    process.exit(1);
  }

  const isSingleFile = fs.lstatSync(absPath).isFile();
  const concurrency = parseInt(
    opts.concurrency || String(DEFAULT_CONCURRENCY),
    10,
  );

  ui.section("Geração / Migração de Testes Unitários");
  printKeyValue("Alvo:", absPath);
  printKeyValue(
    "Modo:",
    opts.fromSpec
      ? chalk.yellow("migrar specs AngularJS")
      : chalk.green("gerar novos testes"),
  );
  printKeyValue(
    "Saída:",
    opts.output
      ? path.resolve(opts.output)
      : chalk.dim("ao lado do arquivo (.spec.ts)"),
  );
  printKeyValue(
    "Dry-run:",
    opts.dryRun ? chalk.yellow("sim") : chalk.dim("não"),
  );
  ui.blank();

  let files = [];

  if (isSingleFile) {
    files = [{ absPath, path: path.basename(absPath) }];
  } else {
    // Discover files
    const isSpecMode = opts.fromSpec;
    const pattern = isSpecMode ? "**/*.spec.{js,ts}" : "**/*.{ts,js}";

    const raw = await glob(pattern, {
      cwd: absPath,
      ignore: ["node_modules/**", "dist/**", ".angular/**", "**/*.spec.ts"],
    });

    files = raw
      .filter((f) => !f.includes("node_modules") && !f.includes("dist/"))
      .filter((f) =>
        opts.fromSpec
          ? f.includes(".spec.") || f.includes(".test.")
          : !f.includes(".spec.") && !f.includes(".test."),
      )
      .map((f) => ({ absPath: path.join(absPath, f), path: f }));
  }

  if (opts.only) {
    const regex = new RegExp(opts.only.replace(/\*/g, ".*"));
    files = files.filter((f) => regex.test(f.path));
  }

  if (files.length === 0) {
    ui.warn("Nenhum arquivo encontrado para processamento.");
    return;
  }

  printKeyValue("Arquivos:", String(files.length));
  ui.blank();

  if (opts.dryRun) {
    ui.section("Dry-run — arquivos que seriam processados");
    files.forEach((f) => console.log(chalk.dim("  → ") + f.path));
    ui.blank();
    ui.info("Rode sem --dry-run para executar.");
    printSeparator();
    return;
  }

  const stats = { success: 0, skipped: 0, errors: 0 };
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

  bar.start(files.length, 0, { filename: "" });
  let done = 0;

  const limit = pLimit(concurrency);

  const tasks = files.map((fileInfo) =>
    limit(async () => {
      bar.update(done, { filename: fileInfo.path });

      try {
        const code = fs.readFileSync(fileInfo.absPath, "utf-8");
        if (!code.trim()) {
          stats.skipped++;
          done++;
          bar.update(done, { filename: fileInfo.path });
          return;
        }

        dbgFile("lendo", fileInfo.path, `${code.length} chars`);

        let result;
        const isSpec =
          fileInfo.path.includes(".spec.") || fileInfo.path.includes(".test.");

        if (opts.fromSpec && isSpec) {
          // Migrate existing spec
          result = await migrateSpecWithAI(code, fileInfo.path);
          const outputPath = resolveOutputPath(
            fileInfo.absPath,
            opts.output,
            ".spec.ts",
          );
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, result.codigoMigrado, "utf-8");
          dbg(`[generate-tests] spec migrado: ${outputPath}`);
        } else {
          // Generate new tests
          const tipo = detectType(code, fileInfo.path);
          result = await generateTestsWithAI(code, fileInfo.path, tipo);
          const outputPath = resolveOutputPath(
            fileInfo.absPath,
            opts.output,
            ".spec.ts",
          );
          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, result.testFile, "utf-8");
          dbg(
            `[generate-tests] testes gerados: ${outputPath} (${result.testCount} casos)`,
          );
        }

        stats.success++;
      } catch (err) {
        dbg(`[generate-tests] ERRO em ${fileInfo.path}: ${err.message}`);
        stats.errors++;
      }

      done++;
      bar.update(done, { filename: fileInfo.path });
    }),
  );

  await Promise.all(tasks);
  bar.stop();

  ui.blank();
  ui.success(`Concluído: ${stats.success} arquivo(s) processados`);
  if (stats.skipped) ui.info(`${stats.skipped} arquivo(s) ignorados (vazios)`);
  if (stats.errors)
    ui.warn(`${stats.errors} erro(s) — use --debug para detalhes`);
  printSeparator();
}

function resolveOutputPath(sourceAbsPath, outputDir, suffix) {
  const ext = path.extname(sourceAbsPath);
  const base = path.basename(sourceAbsPath, ext);
  const dir = outputDir ? path.resolve(outputDir) : path.dirname(sourceAbsPath);
  // Avoid double .spec.spec.ts
  const cleanBase = base.replace(/\.spec$/, "").replace(/\.test$/, "");
  return path.join(dir, `${cleanBase}${suffix}`);
}

function detectType(code, filePath) {
  if (/@Component\s*\(/.test(code) || filePath.includes(".component."))
    return "component";
  if (/@Injectable/.test(code) || filePath.includes(".service."))
    return "service";
  if (/@Pipe\s*\(/.test(code) || filePath.includes(".pipe.")) return "pipe";
  if (/@Directive\s*\(/.test(code) || filePath.includes(".directive."))
    return "directive";
  if (filePath.includes(".guard.")) return "guard";
  if (filePath.includes(".resolver.")) return "resolver";
  return "auto";
}
