import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import { glob } from "glob";
import { analyzeWithAI } from "../utils/ai.js";
import { parseAnalyzeResponse } from "../utils/parser.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";
import { dbgFile, dbgAI, dbg } from "../utils/debug.js";

const COMPLEXITY_COLOR = {
  baixa: chalk.green,
  média: chalk.yellow,
  alta: chalk.red,
};

export async function analyzeCommand(target, opts) {
  const targetPath = path.resolve(target);
  const isDir =
    fs.existsSync(targetPath) && fs.lstatSync(targetPath).isDirectory();

  let files = [];

  if (isDir) {
    files = await glob("**/*.{js,ts,html}", {
      cwd: targetPath,
      ignore: ["node_modules/**", "dist/**", ".angular/**"],
      absolute: true,
    });
    ui.section(`Analisando projeto: ${targetPath}`);
    ui.info(`${files.length} arquivo(s) encontrado(s)`);
  } else {
    files = [targetPath];
    ui.section(`Analisando arquivo: ${path.basename(targetPath)}`);
  }

  if (files.length === 0) {
    ui.warn("Nenhum arquivo .js/.ts/.html encontrado.");
    return;
  }

  const results = [];

  for (const file of files) {
    const code = fs.readFileSync(file, "utf-8");

    // Skip arquivos que não parecem AngularJS
    if (!looksLikeAngularJS(code)) {
      dbg(
        `skip (sem padrões AngularJS): ${path.relative(isDir ? targetPath : path.dirname(file), file)}`,
      );
      continue;
    }

    const relPath = isDir
      ? path.relative(targetPath, file)
      : path.basename(file);
    dbgFile("lendo", relPath, `${code.length} chars`);
    dbgAI("enviando", "analysis", `arquivo=${relPath}`);
    const spinner = ora(chalk.dim(`Analisando ${relPath}...`)).start();

    try {
      const raw = await analyzeWithAI(code, relPath);
      const parsed = parseAnalyzeResponse(raw);
      dbgAI(
        "resposta",
        "analysis",
        `complexidade=${parsed.complexidade} | padrões=${parsed.padroes?.length || 0}`,
      );
      results.push({ file: relPath, ...parsed });
      spinner.succeed(
        chalk.dim(`${relPath} — `) + complexityBadge(parsed.complexidade),
      );
    } catch (err) {
      spinner.fail(chalk.red(`Erro em ${relPath}: ${err.message}`));
    }
  }

  if (results.length === 0) {
    ui.blank();
    ui.warn("Nenhum padrão AngularJS detectado nos arquivos.");
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  // Resumo geral
  const altas = results.filter((r) => r.complexidade === "alta").length;
  const medias = results.filter((r) => r.complexidade === "média").length;
  const baixas = results.filter((r) => r.complexidade === "baixa").length;

  ui.blank();
  ui.section("Relatório de Análise");

  printKeyValue("Arquivos AngularJS:", String(results.length));
  printKeyValue("Complexidade alta:", chalk.red(String(altas)));
  printKeyValue("Complexidade média:", chalk.yellow(String(medias)));
  printKeyValue("Complexidade baixa:", chalk.green(String(baixas)));

  // Detalhes por arquivo
  for (const r of results) {
    ui.blank();
    console.log(
      chalk.bold.white(`  📄 ${r.file}`) +
        "  " +
        complexityBadge(r.complexidade),
    );

    if (r.padroes.length > 0) {
      console.log(
        chalk.dim("     Padrões: ") +
          r.padroes
            .slice(0, 5)
            .map((p) => chalk.red(p))
            .join(", "),
      );
    }

    if (r.ordemSugerida.length > 0) {
      console.log(
        chalk.dim("     Próximo passo: ") + chalk.cyan(r.ordemSugerida[0]),
      );
    }

    if (r.problemas.length > 0) {
      r.problemas.forEach((p) => {
        console.log(chalk.yellow("     ⚠ ") + chalk.dim(p));
      });
    }
  }

  printSeparator();
  ui.blank();
  ui.info(
    "Use " +
      chalk.cyan("ng-migrate migrate <arquivo>") +
      " para migrar cada arquivo.",
  );
  ui.info(
    "Use " + chalk.cyan("ng-migrate checklist") + " para ver o plano completo.",
  );
  ui.blank();
}

function looksLikeAngularJS(code) {
  const patterns = [
    /angular\.module/,
    /\$scope/,
    /\$http/,
    /\$routeProvider/,
    /\.controller\s*\(/,
    /\.service\s*\(/,
    /\.factory\s*\(/,
    /\.directive\s*\(/,
    /\.filter\s*\(/,
    /ng-app/,
    /ng-controller/,
    /ng-repeat/,
    /ng-if/,
    /ng-model/,
  ];
  return patterns.some((p) => p.test(code));
}

function complexityBadge(c) {
  const fn = COMPLEXITY_COLOR[c] || chalk.gray;
  return fn.bold(`[${c || "?"}]`);
}
