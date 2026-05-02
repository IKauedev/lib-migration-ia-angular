/**
 * html-report.js
 * Gera relatório HTML interativo da migração — filtros, diffs expandíveis, gráficos.
 * Arquivo único, sem dependências externas (CSS/JS embutidos).
 */

import fs from "fs";
import path from "path";

/**
 * Escapa HTML para exibição segura.
 * @param {string} str
 * @returns {string}
 */
function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Retorna classe CSS de cor para status de migração.
 * @param {string} status
 * @returns {string}
 */
function statusClass(status) {
  if (!status) return "status-unknown";
  const s = status.toLowerCase();
  if (s === "migrado" || s === "success" || s === "ok") return "status-ok";
  if (s === "parcial" || s === "warn" || s === "warning") return "status-warn";
  if (s === "falha" || s === "error" || s === "failed") return "status-fail";
  return "status-unknown";
}

/**
 * Gera o HTML de uma tabela de arquivos migrados.
 * @param {Array<object>} files
 * @returns {string}
 */
function buildFilesTable(files) {
  if (!files || files.length === 0) return "<p>Nenhum arquivo registrado.</p>";

  const rows = files
    .map((f, i) => {
      const status = f.status || "desconhecido";
      const cls = statusClass(status);
      const diff = f.diff
        ? `
      <tr class="diff-row" id="diff-${i}" style="display:none">
        <td colspan="6">
          <pre class="diff-block">${escHtml(f.diff)}</pre>
        </td>
      </tr>`
        : "";

      return `
    <tr class="file-row" data-phase="${escHtml(f.phase || "")}" data-status="${escHtml(status)}">
      <td>${escHtml(f.path || f.name || "")}</td>
      <td><span class="phase-tag">${escHtml(f.phase || "-")}</span></td>
      <td><span class="badge ${cls}">${escHtml(status)}</span></td>
      <td>${escHtml(String(f.loc || f.lines || "-"))}</td>
      <td>${escHtml(String(f.score ?? "-"))}</td>
      <td>${f.diff ? `<button class="btn-diff" onclick="toggleDiff(${i})">diff</button>` : "-"}</td>
    </tr>${diff}`;
    })
    .join("");

  return `
  <table id="files-table">
    <thead>
      <tr>
        <th>Arquivo</th>
        <th>Fase</th>
        <th>Status</th>
        <th>LOC</th>
        <th>Score</th>
        <th>Diff</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * Gera o bloco de estatísticas do cabeçalho.
 * @param {object} report
 * @returns {string}
 */
function buildStats(report) {
  const stats = report.stats || {};
  const total = stats.total || report.totalFiles || 0;
  const migrated = stats.migrated || stats.success || 0;
  const failed = stats.failed || stats.errors || 0;
  const partial = stats.partial || stats.warnings || 0;
  const score = report.overallScore ?? report.qualityScore ?? "-";
  const duration = report.duration
    ? `${Math.round(report.duration / 1000)}s`
    : "-";

  return `
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${total}</div>
      <div class="stat-label">Total de arquivos</div>
    </div>
    <div class="stat-card ok">
      <div class="stat-value">${migrated}</div>
      <div class="stat-label">Migrados</div>
    </div>
    <div class="stat-card warn">
      <div class="stat-value">${partial}</div>
      <div class="stat-label">Parciais</div>
    </div>
    <div class="stat-card fail">
      <div class="stat-value">${failed}</div>
      <div class="stat-label">Com falha</div>
    </div>
    <div class="stat-card score">
      <div class="stat-value">${score}</div>
      <div class="stat-label">Score qualidade</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${duration}</div>
      <div class="stat-label">Duração</div>
    </div>
  </div>`;
}

/**
 * Gera o gráfico de fases em SVG (barras simples).
 * @param {object[]} phases
 * @returns {string}
 */
function buildPhasesChart(phases) {
  if (!phases || phases.length === 0) return "";

  const maxCount = Math.max(...phases.map((p) => p.count || 0), 1);
  const barWidth = 40;
  const gap = 12;
  const chartWidth = phases.length * (barWidth + gap) + gap;
  const chartHeight = 120;

  const bars = phases
    .map((phase, i) => {
      const barH = Math.max(
        4,
        Math.round(((phase.count || 0) / maxCount) * 80),
      );
      const x = gap + i * (barWidth + gap);
      const y = chartHeight - 30 - barH;
      const label = (phase.name || phase.phase || "").slice(0, 8);

      return `
    <rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" class="bar-${(i % 6) + 1}" rx="3"/>
    <text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" class="bar-count">${phase.count || 0}</text>
    <text x="${x + barWidth / 2}" y="${chartHeight - 10}" text-anchor="middle" class="bar-label">${escHtml(label)}</text>`;
    })
    .join("");

  return `
  <div class="chart-wrap">
    <h3>Arquivos por fase</h3>
    <svg width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}">
      ${bars}
    </svg>
  </div>`;
}

/**
 * Constrói o HTML completo do relatório.
 *
 * @param {object} reportData - Dados do relatório de migração
 * @param {string} [reportData.projectName]
 * @param {string} [reportData.generatedAt]
 * @param {object} [reportData.stats]
 * @param {Array}  [reportData.files]
 * @param {Array}  [reportData.phases]
 * @param {number} [reportData.overallScore]
 * @param {number} [reportData.duration]
 * @returns {string} HTML completo
 */
export function buildHtmlReport(reportData) {
  const projectName = escHtml(reportData.projectName || "Projeto");
  const generatedAt = escHtml(
    reportData.generatedAt || new Date().toLocaleString("pt-BR"),
  );

  const allPhases = Array.from(
    new Set((reportData.files || []).map((f) => f.phase || "").filter(Boolean)),
  );

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório de Migração — ${projectName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; }
    header { background: linear-gradient(135deg, #1a1f2e, #2d3748); padding: 24px 32px; border-bottom: 1px solid #2d3748; }
    header h1 { font-size: 1.5rem; color: #63b3ed; }
    header .meta { font-size: 0.85rem; color: #718096; margin-top: 4px; }
    .container { max-width: 1200px; margin: 0 auto; padding: 24px 32px; }
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .stat-card { background: #1a202c; border: 1px solid #2d3748; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-card.ok { border-color: #276749; }
    .stat-card.warn { border-color: #975a16; }
    .stat-card.fail { border-color: #742a2a; }
    .stat-card.score { border-color: #553c9a; }
    .stat-value { font-size: 2rem; font-weight: 700; color: #e2e8f0; }
    .stat-card.ok .stat-value { color: #68d391; }
    .stat-card.warn .stat-value { color: #f6ad55; }
    .stat-card.fail .stat-value { color: #fc8181; }
    .stat-card.score .stat-value { color: #b794f4; }
    .stat-label { font-size: 0.75rem; color: #718096; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.05em; }
    .filters { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; align-items: center; }
    .filters label { font-size: 0.85rem; color: #a0aec0; }
    select, input[type=text] { background: #2d3748; color: #e2e8f0; border: 1px solid #4a5568; border-radius: 6px; padding: 6px 10px; font-size: 0.9rem; }
    input[type=text] { min-width: 220px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    th { background: #2d3748; padding: 10px 12px; text-align: left; color: #a0aec0; font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; position: sticky; top: 0; z-index: 1; }
    td { padding: 8px 12px; border-bottom: 1px solid #1a202c; vertical-align: middle; word-break: break-all; }
    tr.file-row:hover td { background: #1a202c; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 600; }
    .status-ok { background: #22543d; color: #9ae6b4; }
    .status-warn { background: #7b341e; color: #fbd38d; }
    .status-fail { background: #63171b; color: #fed7d7; }
    .status-unknown { background: #2d3748; color: #a0aec0; }
    .phase-tag { display: inline-block; background: #2d3748; color: #90cdf4; font-size: 0.7rem; padding: 1px 6px; border-radius: 4px; }
    .btn-diff { background: #2b6cb0; color: #bee3f8; border: none; border-radius: 4px; padding: 3px 8px; cursor: pointer; font-size: 0.75rem; }
    .btn-diff:hover { background: #3182ce; }
    .diff-row td { background: #1a202c; padding: 0; }
    .diff-block { font-family: monospace; font-size: 0.8rem; padding: 12px; overflow-x: auto; white-space: pre; color: #a0aec0; max-height: 400px; overflow-y: auto; }
    .chart-wrap { margin-bottom: 32px; }
    .chart-wrap h3 { font-size: 1rem; color: #90cdf4; margin-bottom: 12px; }
    svg text { fill: #a0aec0; font-size: 10px; }
    svg .bar-count { font-size: 9px; fill: #e2e8f0; }
    .bar-1 { fill: #4299e1; }
    .bar-2 { fill: #48bb78; }
    .bar-3 { fill: #ed8936; }
    .bar-4 { fill: #9f7aea; }
    .bar-5 { fill: #f56565; }
    .bar-6 { fill: #38b2ac; }
    h2 { font-size: 1.1rem; color: #90cdf4; margin-bottom: 16px; margin-top: 32px; }
    .section { margin-bottom: 40px; }
    footer { text-align: center; padding: 24px; font-size: 0.75rem; color: #4a5568; border-top: 1px solid #2d3748; margin-top: 40px; }
    .hidden { display: none !important; }
  </style>
</head>
<body>
  <header>
    <h1>Relatório de Migração AngularJS → Angular 21</h1>
    <div class="meta">Projeto: <strong>${projectName}</strong> &nbsp;|&nbsp; Gerado em: ${generatedAt}</div>
  </header>

  <div class="container">
    <div class="section">
      <h2>Estatísticas</h2>
      ${buildStats(reportData)}
    </div>

    ${
      reportData.phases
        ? `
    <div class="section">
      ${buildPhasesChart(reportData.phases)}
    </div>`
        : ""
    }

    <div class="section">
      <h2>Arquivos Migrados</h2>
      <div class="filters">
        <label>Fase:</label>
        <select id="filter-phase" onchange="applyFilters()">
          <option value="">Todas</option>
          ${allPhases.map((p) => `<option value="${escHtml(p)}">${escHtml(p)}</option>`).join("")}
        </select>
        <label>Status:</label>
        <select id="filter-status" onchange="applyFilters()">
          <option value="">Todos</option>
          <option value="migrado">Migrado</option>
          <option value="parcial">Parcial</option>
          <option value="falha">Falha</option>
        </select>
        <input type="text" id="filter-search" placeholder="Filtrar por nome..." oninput="applyFilters()">
      </div>
      ${buildFilesTable(reportData.files || [])}
    </div>
  </div>

  <footer>Gerado por ng-migrate-angularjs-ai &nbsp;|&nbsp; github.com/ng-migrate</footer>

  <script>
    function toggleDiff(i) {
      const row = document.getElementById('diff-' + i);
      if (row) row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
    }

    function applyFilters() {
      const phase = document.getElementById('filter-phase').value.toLowerCase();
      const status = document.getElementById('filter-status').value.toLowerCase();
      const search = document.getElementById('filter-search').value.toLowerCase();
      const rows = document.querySelectorAll('tr.file-row');

      rows.forEach(function(row) {
        const rowPhase = (row.dataset.phase || '').toLowerCase();
        const rowStatus = (row.dataset.status || '').toLowerCase();
        const rowText = row.textContent.toLowerCase();

        const phaseMatch = !phase || rowPhase === phase;
        const statusMatch = !status || rowStatus.includes(status);
        const searchMatch = !search || rowText.includes(search);

        row.style.display = phaseMatch && statusMatch && searchMatch ? '' : 'none';
      });
    }
  </script>
</body>
</html>`;
}

/**
 * Salva o relatório HTML em disco.
 *
 * @param {string} html - HTML gerado por buildHtmlReport()
 * @param {string} outputDir - Diretório de saída
 * @param {string} [filename] - Nome do arquivo (padrão: MIGRATION_REPORT.html)
 * @returns {string} Caminho completo do arquivo salvo
 */
export function saveHtmlReport(
  html,
  outputDir,
  filename = "MIGRATION_REPORT.html",
) {
  const filePath = path.join(outputDir, filename);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, html, "utf8");
  return filePath;
}
