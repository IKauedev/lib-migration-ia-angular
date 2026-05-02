import fs from "fs";
import path from "path";

export function buildReport({
  repoName,
  provider,
  branch,
  stats,
  depReport,
  errors,
  outputDir,
  prUrl,
  qualityReport,
}) {
  const now = new Date().toISOString();

  const lines = [
    `# Relatório de Migração — ${repoName}`,
    ``,
    `**Data:** ${now}`,
    `**Provedor:** ${provider}`,
    `**Branch migrada:** ${branch}`,
    `**Pasta de saída:** ${outputDir || "(dry-run)"}`,
    prUrl ? `**Pull Request / MR:** ${prUrl}` : "",
    ``,
    `---`,
    ``,
    `## Resumo`,
    ``,
    `| Métrica | Valor |`,
    `|---|---|`,
    `| Arquivos AngularJS encontrados | ${stats.total} |`,
    `| Migrados com sucesso | ${stats.success} |`,
    `| Ignorados (não-AngularJS) | ${stats.skipped} |`,
    `| Erros | ${stats.errors} |`,
    ``,
    `---`,
    ``,
  ];

  if (depReport) {
    lines.push(`## Dependências`);
    lines.push(``);

    if (depReport.added.length) {
      lines.push(`### Adicionadas`);
      depReport.added.forEach((d) => lines.push(`- \`${d}\``));
      lines.push(``);
    }
    if (depReport.updated.length) {
      lines.push(`### Atualizadas`);
      depReport.updated.forEach((d) => lines.push(`- ${d}`));
      lines.push(``);
    }
    if (depReport.removed.length) {
      lines.push(`### Removidas (AngularJS)`);
      depReport.removed.forEach((d) => lines.push(`- ~~\`${d}\`~~`));
      lines.push(``);
    }
    if (depReport.warnings.length) {
      lines.push(`### ⚠ Avisos de dependências`);
      depReport.warnings.forEach((w) => lines.push(`- ${w}`));
      lines.push(``);
    }
    lines.push(`---`, ``);
  }

  if (stats.files && stats.files.length) {
    lines.push(`## Arquivos migrados`);
    lines.push(``);
    lines.push(`| Arquivo | Tipo | Status |`);
    lines.push(`|---|---|---|`);
    stats.files.forEach((f) => {
      const status = f.error ? `❌ ${f.error}` : "✅ OK";
      lines.push(`| \`${f.path}\` | ${f.tipo || "?"} | ${status} |`);
    });
    lines.push(``);
  }

  if (errors && errors.length) {
    lines.push(`## Erros`);
    lines.push(``);
    errors.forEach((e) => {
      lines.push(`- **${e.file}**: ${e.message}`);
    });
    lines.push(``);
  }

  if (qualityReport) {
    lines.push(`---`);
    lines.push(``);
    lines.push(`## Qualidade da Migração`);
    lines.push(``);
    const score = qualityReport.overallScore ?? null;
    if (score !== null) {
      const bar = _scoreBar(score);
      lines.push(`**Score geral:** ${score}/100  ${bar}`);
      lines.push(``);
    }
    if (qualityReport.tsErrors?.length) {
      lines.push(
        `### ❌ Erros de Compilação TypeScript (${qualityReport.tsErrors.length})`,
      );
      lines.push(``);
      lines.push(`| Arquivo | Linha | Mensagem |`);
      lines.push(`|---|---|---|`);
      qualityReport.tsErrors.slice(0, 50).forEach((e) => {
        lines.push(
          `| \`${e.file || ""}\` | ${e.line || ""} | ${e.message || ""} |`,
        );
      });
      if (qualityReport.tsErrors.length > 50) {
        lines.push(
          `| … | … | +${qualityReport.tsErrors.length - 50} erros adicionais |`,
        );
      }
      lines.push(``);
    }
    if (qualityReport.symbolCollisions?.length) {
      lines.push(`### ⚠ Colisões de Símbolo Resolvidas`);
      lines.push(``);
      qualityReport.symbolCollisions.forEach((c) => {
        lines.push(`- \`${c.className}\` — presente em: ${c.files.join(", ")}`);
      });
      lines.push(``);
    }
    if (qualityReport.residualPatterns?.length) {
      lines.push(`### ⚠ Padrões AngularJS Residuais Detectados`);
      lines.push(``);
      lines.push(
        `Os seguintes arquivos podem conter código AngularJS não migrado:`,
      );
      lines.push(``);
      qualityReport.residualPatterns.forEach((r) => {
        lines.push(`- \`${r.file}\`: ${r.patterns.join(", ")}`);
      });
      lines.push(``);
    }
    if (qualityReport.chunkedFiles?.length) {
      lines.push(`### ℹ Arquivos Migrados em Chunks (arquivos grandes)`);
      lines.push(``);
      qualityReport.chunkedFiles.forEach((f) => {
        lines.push(`- \`${f.file}\` — ${f.chunks} chunks`);
      });
      lines.push(``);
    }
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Próximos passos`);
  lines.push(``);
  lines.push(
    `1. Revisar cada arquivo migrado em \`${outputDir || "output"}/\``,
  );
  lines.push(`2. Rodar \`npm install\` na pasta de saída`);
  lines.push(`3. Rodar \`ng build\` e corrigir erros de compilação TypeScript`);
  lines.push(`4. Executar os testes: \`ng test\``);
  lines.push(`5. Revisar as rotas e lazy loading`);
  lines.push(`6. Verificar o checklist completo: \`ng-migrate checklist\``);

  return lines.filter((l) => l !== undefined).join("\n");
}

function _scoreBar(score) {
  const filled = Math.round(score / 10);
  return "█".repeat(filled) + "░".repeat(10 - filled) + ` ${score}%`;
}

/**
 * Computa o score de qualidade da migração (0-100).
 * @param {{success: number, total: number}} stats
 * @param {number} tsErrorCount
 * @param {number} residualCount
 * @returns {number}
 */
export function computeQualityScore(stats, tsErrorCount, residualCount) {
  if (!stats.total) return 0;
  const successRate = stats.success / stats.total;
  const tsDeduction = Math.min(tsErrorCount * 2, 30);
  const residualDeduction = Math.min(residualCount * 5, 20);
  return Math.max(
    0,
    Math.round(successRate * 100 - tsDeduction - residualDeduction),
  );
}

/**
 * Analisa arquivos migrados em busca de padrões AngularJS residuais.
 * @param {Array<{path: string, code: string}>} migratedFiles
 * @returns {Array<{file: string, patterns: string[]}>}
 */
export function detectResidualPatterns(migratedFiles) {
  const RESIDUAL_PATTERNS = [
    { regex: /angular\.module\s*\(/, label: "angular.module()" },
    { regex: /\$scope\b/, label: "$scope" },
    { regex: /\$http\b/, label: "$http" },
    { regex: /\$routeProvider\b/, label: "$routeProvider" },
    { regex: /ng-controller\s*=/, label: "ng-controller" },
    { regex: /ng-repeat\s*=/, label: "ng-repeat" },
    { regex: /ng-if\s*=/, label: "ng-if" },
    { regex: /\.controller\s*\(/, label: ".controller()" },
    { regex: /\.service\s*\(/, label: ".service()" },
    { regex: /\.factory\s*\(/, label: ".factory()" },
    { regex: /\.filter\s*\(/, label: ".filter()" },
    { regex: /\.directive\s*\(/, label: ".directive()" },
  ];

  const results = [];
  for (const { path: filePath, code } of migratedFiles) {
    if (!code) continue;
    const found = [];
    for (const { regex, label } of RESIDUAL_PATTERNS) {
      if (regex.test(code)) found.push(label);
    }
    if (found.length) results.push({ file: filePath, patterns: found });
  }
  return results;
}

export function saveReport(content, outputDir) {
  const reportPath = path.join(outputDir, "MIGRATION_REPORT.md");
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, content, "utf-8");
  return reportPath;
}
