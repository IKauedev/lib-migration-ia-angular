import fs from "fs";
import path from "path";
import ora from "ora";
import chalk from "chalk";
import pLimit from "p-limit";
import cliProgress from "cli-progress";
import {
  GitHubClient,
  GitLabClient,
  parseRepoArg,
  detectProvider,
} from "../utils/git-providers.js";
import { migrateWithAI } from "../utils/ai.js";
import { parseMigrateResponse } from "../utils/parser.js";
import { migrateDependencies } from "../utils/deps-migrator.js";
import { buildReport, saveReport } from "../utils/report.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";

const MIGRATE_EXTS = [".js", ".ts", ".html"];
const SKIP_PATTERNS = [
  /node_modules/,
  /\.min\.js$/,
  /dist\//,
  /coverage\//,
  /\.spec\.(js|ts)$/,
  /karma\.conf/,
  /protractor/,
  /\.git\//,
  /\.angular\//,
  /e2e\//,
];

const NG_PATTERNS = [
  /angular\.module/,
  /\$scope/,
  /\$http[^C]/,
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
  /\$routeProvider/,
  /\$stateProvider/,
  /\$q\./,
  /\$timeout/,
  /\$broadcast/,
  /\$emit/,
];

function isAngularJS(content) {
  return NG_PATTERNS.some((p) => p.test(content));
}

function shouldSkip(filePath) {
  return SKIP_PATTERNS.some((p) => p.test(filePath));
}

function matchesOnly(filePath, only) {
  if (!only) return true;

  const regex = new RegExp(
    "^" +
      only.replace(/\*\*/g, "§§").replace(/\*/g, "[^/]*").replace(/§§/g, ".*") +
      "$",
  );
  return regex.test(filePath);
}

export async function migrateRepoCommand(repoArg, opts) {
  const githubToken = opts.githubToken || process.env.GITHUB_TOKEN;
  const gitlabToken = opts.gitlabToken || process.env.GITLAB_TOKEN;
  const provider = detectProvider(repoArg, opts);

  if (provider === "github" && !githubToken) {
    ui.error("Token do GitHub não encontrado.");
    ui.info(
      "Defina: export GITHUB_TOKEN=ghp_... ou use --github-token <token>",
    );
    process.exit(1);
  }
  if (provider === "gitlab" && !gitlabToken) {
    ui.error("Token do GitLab não encontrado.");
    ui.info(
      "Defina: export GITLAB_TOKEN=glpat-... ou use --gitlab-token <token>",
    );
    process.exit(1);
  }

  const repoPath = parseRepoArg(repoArg);
  const repoName = repoPath.split("/").pop();
  const outputDir = path.resolve(opts.output || `./${repoName}-angular21`);
  const concurrency = parseInt(opts.concurrency || "3", 10);

  const client =
    provider === "github"
      ? new GitHubClient(githubToken)
      : new GitLabClient(gitlabToken, opts.gitlabUrl);

  ui.section(`Migração de Repositório`);
  printKeyValue("Provedor:", provider === "github" ? "🐙 GitHub" : "🦊 GitLab");
  printKeyValue("Repositório:", repoPath);
  printKeyValue(
    "Modo:",
    opts.dryRun
      ? chalk.yellow("dry-run (sem salvar)")
      : chalk.green("migração completa"),
  );
  printKeyValue("Concorrência:", String(concurrency));
  if (opts.only) printKeyValue("Filtro:", opts.only);
  ui.blank();

  let spinner = ora(chalk.dim("Conectando ao repositório...")).start();
  let branch;

  try {
    if (provider === "github") {
      const [owner, repo] = repoPath.split("/");
      branch = opts.branch || (await client.getDefaultBranch(owner, repo));
    } else {
      branch = opts.branch || (await client.getDefaultBranch(repoPath));
    }
    spinner.succeed(`Branch: ${chalk.cyan(branch)}`);
  } catch (err) {
    spinner.fail(chalk.red(err.message));
    process.exit(1);
  }

  spinner = ora(chalk.dim("Listando arquivos do repositório...")).start();
  let allFiles;

  try {
    if (provider === "github") {
      const [owner, repo] = repoPath.split("/");
      allFiles = await client.listFiles(owner, repo, branch);
    } else {
      allFiles = await client.listFiles(repoPath, branch);
    }
    spinner.succeed(
      `${allFiles.length} arquivo(s) encontrado(s) no repositório`,
    );
  } catch (err) {
    spinner.fail(chalk.red(err.message));
    process.exit(1);
  }

  const candidates = allFiles.filter((f) => {
    const ext = path.extname(f.path);
    return (
      MIGRATE_EXTS.includes(ext) &&
      !shouldSkip(f.path) &&
      matchesOnly(f.path, opts.only)
    );
  });

  ui.info(`${candidates.length} arquivo(s) candidato(s) para análise`);
  ui.blank();

  const pkgJsonFile = allFiles.find((f) => f.path === "package.json");
  let originalPkg = null;
  let depReport = null;
  let migratedPkg = null;

  if (pkgJsonFile && !opts.skipDeps) {
    spinner = ora(chalk.dim("Lendo package.json...")).start();
    try {
      let content;
      if (provider === "github") {
        const [owner, repo] = repoPath.split("/");
        content = await client.getFileContent(
          owner,
          repo,
          "package.json",
          branch,
        );
      } else {
        content = await client.getFileContent(repoPath, "package.json", branch);
      }
      if (content) {
        originalPkg = JSON.parse(content);
        const result = migrateDependencies(originalPkg);
        migratedPkg = result.pkg;
        depReport = result.report;
        spinner.succeed("package.json analisado");

        ui.section("Dependências");
        if (depReport.removed.length)
          ui.warn(`${depReport.removed.length} pacotes AngularJS removidos`);
        if (depReport.updated.length)
          ui.info(`${depReport.updated.length} pacotes Angular atualizados`);
        if (depReport.added.length)
          ui.success(
            `${depReport.added.length} pacotes Angular 21 adicionados`,
          );
        ui.blank();
      }
    } catch (err) {
      spinner.warn(
        chalk.yellow("Não foi possível processar package.json: " + err.message),
      );
    }
  }

  ui.step("Identificando arquivos AngularJS...");
  ui.blank();

  const bar = new cliProgress.SingleBar({
    format:
      "  " +
      chalk.cyan("{bar}") +
      " {percentage}% | {value}/{total} arquivos lidos",
    barCompleteChar: "█",
    barIncompleteChar: "░",
    hideCursor: true,
  });

  bar.start(candidates.length, 0);

  const toMigrate = [];
  const limit = pLimit(concurrency);

  await Promise.all(
    candidates.map((f) =>
      limit(async () => {
        try {
          let content;
          if (provider === "github") {
            const [owner, repo] = repoPath.split("/");
            content = await client.getFileContent(owner, repo, f.path, branch);
          } else {
            content = await client.getFileContent(repoPath, f.path, branch);
          }
          if (content && isAngularJS(content)) {
            toMigrate.push({ path: f.path, content });
          }
        } catch (_) {}
        bar.increment();
      }),
    ),
  );

  bar.stop();
  ui.blank();
  ui.success(
    `${toMigrate.length} arquivo(s) AngularJS identificado(s) para migração`,
  );
  ui.blank();

  if (toMigrate.length === 0) {
    ui.warn("Nenhum padrão AngularJS encontrado nos arquivos do repositório.");
    ui.info(
      "O repositório pode já estar em Angular moderno, ou use --only para especificar o caminho.",
    );
    return;
  }

  if (opts.dryRun) {
    ui.section("Dry-run — arquivos que seriam migrados");
    toMigrate.forEach((f) => console.log(chalk.dim("  →") + " " + f.path));
    ui.blank();
    ui.info("Rode sem --dry-run para executar a migração.");
    return;
  }

  ui.section("Migrando arquivos com IA");

  const bar2 = new cliProgress.SingleBar({
    format:
      "  " +
      chalk.magenta("{bar}") +
      " {percentage}% | {value}/{total} | {file}",
    barCompleteChar: "█",
    barIncompleteChar: "░",
    hideCursor: true,
  });

  bar2.start(toMigrate.length, 0, { file: "" });

  const stats = {
    total: toMigrate.length,
    success: 0,
    skipped: 0,
    errors: 0,
    files: [],
  };
  const errors = [];
  const migratedFiles = [];

  const migrateLimit = pLimit(Math.min(concurrency, 3));

  await Promise.all(
    toMigrate.map((f) =>
      migrateLimit(async () => {
        bar2.update(stats.success + stats.errors, {
          file: chalk.dim(f.path.slice(-40)),
        });
        try {
          const raw = await migrateWithAI(f.content, "auto");
          const parsed = parseMigrateResponse(raw);

          const outputPath = getOutputPath(f.path, outputDir);
          const migratedContent = parsed.codigoMigrado || f.content;

          fs.mkdirSync(path.dirname(outputPath), { recursive: true });
          fs.writeFileSync(outputPath, migratedContent, "utf-8");

          migratedFiles.push({
            original: f.path,
            migrated: outputPath,
            content: migratedContent,
            tipo: parsed.tipo,
          });
          stats.files.push({ path: f.path, tipo: parsed.tipo });
          stats.success++;
        } catch (err) {
          stats.errors++;
          errors.push({ file: f.path, message: err.message });
          stats.files.push({ path: f.path, error: err.message });
        }
        bar2.increment();
      }),
    ),
  );

  bar2.stop();
  ui.blank();

  if (migratedPkg) {
    const pkgOut = path.join(outputDir, "package.json");
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(pkgOut, JSON.stringify(migratedPkg, null, 2), "utf-8");
    ui.success("package.json atualizado salvo");
  }

  ui.section("Resultado");
  printKeyValue("✔ Migrados:", chalk.green(String(stats.success)));
  printKeyValue(
    "✖ Erros:",
    stats.errors > 0 ? chalk.red(String(stats.errors)) : chalk.dim("0"),
  );
  printKeyValue("Pasta de saída:", chalk.cyan(outputDir));
  ui.blank();

  if (errors.length > 0) {
    ui.warn("Arquivos com erro:");
    errors
      .slice(0, 5)
      .forEach((e) =>
        console.log(chalk.red("  ✖ ") + e.file + chalk.dim(" — " + e.message)),
      );
    if (errors.length > 5)
      console.log(
        chalk.dim(`  ... e mais ${errors.length - 5} erros (veja o relatório)`),
      );
    ui.blank();
  }

  let prUrl = null;

  if (opts.createPr && stats.success > 0) {
    const prBranch = `ng-migrate-angularjs-ai/${Date.now()}`;
    spinner = ora(
      chalk.dim(`Criando branch ${prBranch} e enviando arquivos...`),
    ).start();

    try {
      if (provider === "github") {
        const [owner, repo] = repoPath.split("/");
        await client.createBranch(owner, repo, prBranch, branch);

        for (const f of migratedFiles) {
          const existingSha = await client.getFileSha(
            owner,
            repo,
            f.original,
            branch,
          );

          const destPath = f.original.replace(/\.js$/, ".ts");
          await client.createOrUpdateFile(
            owner,
            repo,
            destPath,
            f.content,
            `chore(migrate): ${destPath} → Angular 21`,
            prBranch,
            existingSha,
          );
        }

        if (migratedPkg) {
          const pkgSha = await client.getFileSha(
            owner,
            repo,
            "package.json",
            branch,
          );
          await client.createOrUpdateFile(
            owner,
            repo,
            "package.json",
            JSON.stringify(migratedPkg, null, 2),
            "chore(migrate): update dependencies to Angular 21",
            prBranch,
            pkgSha,
          );
        }

        const pr = await client.createPullRequest(
          owner,
          repo,
          prBranch,
          branch,
          `🚀 Migração AngularJS → Angular 21 (ng-migrate-angularjs-ai)`,
          buildPRBody(stats, depReport),
        );
        prUrl = pr.html_url;
      } else {
        await client.createBranch(repoPath, prBranch, branch);

        for (const f of migratedFiles) {
          const destPath = f.original.replace(/\.js$/, ".ts");
          await client.createOrUpdateFile(
            repoPath,
            destPath,
            f.content,
            `chore(migrate): ${destPath} → Angular 21`,
            prBranch,
          );
        }

        if (migratedPkg) {
          await client.createOrUpdateFile(
            repoPath,
            "package.json",
            JSON.stringify(migratedPkg, null, 2),
            "chore(migrate): update dependencies to Angular 21",
            prBranch,
          );
        }

        const mr = await client.createMergeRequest(
          repoPath,
          prBranch,
          branch,
          `🚀 Migração AngularJS → Angular 21 (ng-migrate-angularjs-ai)`,
          buildPRBody(stats, depReport),
        );
        prUrl = mr.web_url;
      }

      spinner.succeed(chalk.green("Pull Request criado: ") + chalk.cyan(prUrl));
    } catch (err) {
      spinner.fail(chalk.red("Erro ao criar PR: " + err.message));
    }
    ui.blank();
  }

  const report = buildReport({
    repoName,
    provider,
    branch,
    stats,
    depReport,
    errors,
    outputDir,
    prUrl,
  });
  const reportPath = saveReport(report, outputDir);

  ui.success(`Relatório salvo: ${chalk.cyan(reportPath)}`);
  ui.blank();
  printSeparator();
  ui.blank();
  ui.info("Próximos passos:");
  console.log(chalk.dim(`  1. cd ${outputDir}`));
  console.log(chalk.dim("  2. npm install"));
  console.log(chalk.dim("  3. ng build"));
  console.log(chalk.dim("  4. Revise o MIGRATION_REPORT.md"));
  ui.blank();
}

function getOutputPath(originalPath, outputDir) {
  const ext = path.extname(originalPath);
  const newExt = ext === ".js" ? ".ts" : ext;
  const newPath = originalPath.replace(/\.[^.]+$/, newExt);
  return path.join(outputDir, newPath);
}

function buildPRBody(stats, depReport) {
  const lines = [
    `## 🤖 Migração automática AngularJS → Angular 21`,
    ``,
    `Gerado por **ng-migrate-angularjs-ai** usando Claude AI.`,
    ``,
    `### Resumo`,
    `- ✅ **${stats.success}** arquivos migrados`,
    `- ❌ **${stats.errors}** erros`,
    ``,
  ];

  if (depReport) {
    lines.push(`### Dependências`);
    if (depReport.removed.length)
      lines.push(`- Removidas: ${depReport.removed.join(", ")}`);
    if (depReport.added.length)
      lines.push(`- Adicionadas: ${depReport.added.slice(0, 5).join(", ")}...`);
    lines.push(``);
  }

  lines.push(`### O que foi migrado`);
  lines.push(`- Controllers → Standalone Components com Signals`);
  lines.push(`- Services/Factories → @Injectable({ providedIn: 'root' })`);
  lines.push(`- Filters → Standalone Pipes`);
  lines.push(`- Templates → nova sintaxe @if, @for, @switch`);
  lines.push(`- $http → HttpClient`);
  lines.push(`- $routeProvider → provideRouter()`);
  lines.push(``);
  lines.push(
    `> ⚠️ **Revisar manualmente antes de fazer merge.** A migração automática pode precisar de ajustes.`,
  );

  return lines.join("\n");
}
