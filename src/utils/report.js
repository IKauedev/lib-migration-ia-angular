import fs from 'fs';
import path from 'path';

export function buildReport({ repoName, provider, branch, stats, depReport, errors, outputDir, prUrl }) {
  const now = new Date().toISOString();

  const lines = [
    `# Relatório de Migração — ${repoName}`,
    ``,
    `**Data:** ${now}`,
    `**Provedor:** ${provider}`,
    `**Branch migrada:** ${branch}`,
    `**Pasta de saída:** ${outputDir || '(dry-run)'}`,
    prUrl ? `**Pull Request / MR:** ${prUrl}` : '',
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
      depReport.added.forEach(d => lines.push(`- \`${d}\``));
      lines.push(``);
    }
    if (depReport.updated.length) {
      lines.push(`### Atualizadas`);
      depReport.updated.forEach(d => lines.push(`- ${d}`));
      lines.push(``);
    }
    if (depReport.removed.length) {
      lines.push(`### Removidas (AngularJS)`);
      depReport.removed.forEach(d => lines.push(`- ~~\`${d}\`~~`));
      lines.push(``);
    }
    if (depReport.warnings.length) {
      lines.push(`### ⚠ Avisos de dependências`);
      depReport.warnings.forEach(w => lines.push(`- ${w}`));
      lines.push(``);
    }
    lines.push(`---`, ``);
  }

  if (stats.files && stats.files.length) {
    lines.push(`## Arquivos migrados`);
    lines.push(``);
    lines.push(`| Arquivo | Tipo | Status |`);
    lines.push(`|---|---|---|`);
    stats.files.forEach(f => {
      const status = f.error ? `❌ ${f.error}` : '✅ OK';
      lines.push(`| \`${f.path}\` | ${f.tipo || '?'} | ${status} |`);
    });
    lines.push(``);
  }

  if (errors && errors.length) {
    lines.push(`## Erros`);
    lines.push(``);
    errors.forEach(e => {
      lines.push(`- **${e.file}**: ${e.message}`);
    });
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Próximos passos`);
  lines.push(``);
  lines.push(`1. Revisar cada arquivo migrado em \`${outputDir || 'output'}/\``);
  lines.push(`2. Rodar \`npm install\` na pasta de saída`);
  lines.push(`3. Rodar \`ng build\` e corrigir erros de compilação TypeScript`);
  lines.push(`4. Executar os testes: \`ng test\``);
  lines.push(`5. Revisar as rotas e lazy loading`);
  lines.push(`6. Verificar o checklist completo: \`ng-migrate checklist\``);

  return lines.filter(l => l !== undefined).join('\n');
}

export function saveReport(content, outputDir) {
  const reportPath = path.join(outputDir, 'MIGRATION_REPORT.md');
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(reportPath, content, 'utf-8');
  return reportPath;
}
