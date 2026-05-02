/**
 * libs.js
 * Comando `ng-migrate libs [pasta]`
 *
 * Lê o package.json do projeto e gera um relatório completo de migração
 * de bibliotecas: quais serão substituídas, quais removidas, quais precisam
 * de intervenção manual, e quais são mantidas como estão.
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";
import { buildFullLibReport } from "../utils/lib-mapper.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";

const LIBS_REPORT_FILE = ".ng-migrate-libs.json";

export async function libsCommand(projectPath, opts) {
  const absPath = path.resolve(projectPath || ".");

  if (!fs.existsSync(absPath)) {
    ui.error(`Pasta não encontrada: ${absPath}`);
    process.exit(1);
  }

  const pkgPath = path.join(absPath, "package.json");
  if (!fs.existsSync(pkgPath)) {
    ui.error(`package.json não encontrado em: ${absPath}`);
    ui.info("Certifique-se de estar na raiz do projeto AngularJS.");
    process.exit(1);
  }

  let pkg;
  try {
    pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
  } catch (err) {
    ui.error(`Erro ao ler package.json: ${err.message}`);
    process.exit(1);
  }

  ui.section("Relatório de Migração de Bibliotecas");
  printKeyValue("Projeto:", absPath);
  printKeyValue("package.json:", pkgPath);
  ui.blank();

  const report = buildFullLibReport(pkg);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printLibReport(report, pkg.name || path.basename(absPath));

  if (!opts.noSave) {
    const outPath = path.join(absPath, LIBS_REPORT_FILE);
    const toSave = {
      generatedAt: new Date().toISOString(),
      project: pkg.name || path.basename(absPath),
      version: pkg.version || "unknown",
      ...report,
    };
    fs.writeFileSync(outPath, JSON.stringify(toSave, null, 2), "utf-8");
    ui.blank();
    ui.success(`Relatório salvo em: ${chalk.cyan(outPath)}`);
  }

  printSeparator();
}

// ─── Private helpers ───────────────────────────────────────────────────────

function printLibReport(report, projectName) {
  const { toReplace, toDrop, manual, unknown, kept, totalDeps } = report;
  const actionable =
    toReplace.length + toDrop.length + manual.length + unknown.length;

  // ── Counters summary ──────────────────────────────────────────────────────
  ui.section(`Resumo — ${projectName}`);
  printKeyValue("Total de dependências:", String(totalDeps));
  printKeyValue(
    "  ↳ A substituir:",
    chalk.green(`${toReplace.length} biblioteca(s)`),
  );
  printKeyValue("  ↳ A remover:", chalk.red(`${toDrop.length} biblioteca(s)`));
  printKeyValue(
    "  ↳ Migração manual:",
    chalk.yellow(`${manual.length} biblioteca(s)`),
  );
  printKeyValue(
    "  ↳ Sem mapeamento (AngularJS):",
    chalk.dim(`${unknown.length} biblioteca(s)`),
  );
  printKeyValue(
    "  ↳ Compatíveis / mantidas:",
    chalk.dim(`${kept.length} biblioteca(s)`),
  );

  if (actionable === 0) {
    ui.blank();
    ui.info("Nenhuma biblioteca AngularJS identificada no package.json.");
    return;
  }

  // ── REPLACE ──────────────────────────────────────────────────────────────
  if (toReplace.length > 0) {
    ui.blank();
    printSectionHeader(
      chalk.green("✔"),
      "Bibliotecas a SUBSTITUIR",
      chalk.green,
    );
    console.log(
      chalk.dim(
        "  Essas bibliotecas AngularJS serão trocadas pelos equivalentes Angular 21:\n",
      ),
    );
    for (const lib of toReplace) {
      const from = chalk.red(lib.from);
      const to = chalk.green(lib.to.join(", "));
      const ver = chalk.dim(`(${lib.version})`);
      console.log(`  ${from} ${ver}`);
      console.log(`    ${chalk.dim("→")} ${to}`);
      if (lib.notes) console.log(`    ${chalk.dim(lib.notes)}`);
      console.log();
    }
  }

  // ── DROP ─────────────────────────────────────────────────────────────────
  if (toDrop.length > 0) {
    ui.blank();
    printSectionHeader(chalk.red("✖"), "Bibliotecas a REMOVER", chalk.red);
    console.log(
      chalk.dim(
        "  Essas bibliotecas não têm equivalente Angular (ou são desnecessárias):\n",
      ),
    );
    for (const lib of toDrop) {
      const name = chalk.red(lib.name);
      const ver = chalk.dim(`(${lib.version})`);
      console.log(`  ${name} ${ver}`);
      if (lib.notes) console.log(`    ${chalk.dim(lib.notes)}`);
      console.log();
    }
  }

  // ── MANUAL ───────────────────────────────────────────────────────────────
  if (manual.length > 0) {
    ui.blank();
    printSectionHeader(
      chalk.yellow("⚠"),
      "Bibliotecas com MIGRAÇÃO MANUAL",
      chalk.yellow,
    );
    console.log(
      chalk.dim("  Essas bibliotecas precisam de análise e migração manual:\n"),
    );
    for (const lib of manual) {
      const name = chalk.yellow(lib.name);
      const ver = chalk.dim(`(${lib.version})`);
      console.log(`  ${name} ${ver}`);
      if (lib.notes) console.log(`    ${chalk.dim(lib.notes)}`);
      console.log();
    }
  }

  // ── UNKNOWN ──────────────────────────────────────────────────────────────
  if (unknown.length > 0) {
    ui.blank();
    printSectionHeader(
      chalk.dim("?"),
      "Bibliotecas AngularJS sem Mapeamento",
      chalk.dim,
    );
    console.log(
      chalk.dim(
        "  Parecem ser dependências AngularJS mas não há mapeamento automático disponível:\n",
      ),
    );
    for (const lib of unknown) {
      console.log(
        `  ${chalk.dim(lib.name)} ${chalk.dim(`(${lib.version})`)} — verificar manualmente`,
      );
    }
    console.log();
  }

  // ── KEPT ─────────────────────────────────────────────────────────────────
  if (kept.length > 0 && kept.length <= 30) {
    ui.blank();
    printSectionHeader(
      chalk.cyan("→"),
      "Bibliotecas Mantidas (compatíveis com Angular)",
      chalk.cyan,
    );
    console.log(
      chalk.dim(
        "  Estas dependências são mantidas sem alteração (não são específicas do AngularJS):\n",
      ),
    );
    const sorted = [...kept].sort((a, b) => a.name.localeCompare(b.name));
    for (const lib of sorted) {
      console.log(`  ${chalk.dim(lib.name)} ${chalk.dim(`(${lib.version})`)}`);
    }
    console.log();
  } else if (kept.length > 30) {
    ui.blank();
    ui.info(
      `${kept.length} dependência(s) compatível(is) mantida(s) sem alteração (use --json para ver todas).`,
    );
  }

  // ── migration hint ────────────────────────────────────────────────────────
  if (toReplace.length > 0 || toDrop.length > 0) {
    ui.blank();
    ui.info(
      `Use ${chalk.cyan("ng-migrate migrate-project <pasta>")} para aplicar a migração completa.`,
    );
  }
}

function printSectionHeader(icon, title, colorFn) {
  console.log(`${icon} ${colorFn(chalk.bold(title))}`);
  console.log(colorFn("  " + "─".repeat(60)));
}
