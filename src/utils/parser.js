export function parseMigrateResponse(text) {
  const result = {
    tipo: '',
    padroes: [],
    codigoOriginal: '',
    codigoMigrado: '',
    mudancas: [],
    notas: '',
    raw: text,
  };

  // Tipo
  const tipoMatch = text.match(/TIPO:\s*(.+)/i);
  if (tipoMatch) result.tipo = tipoMatch[1].trim();

  // Padrões detectados
  const padroesMatch = text.match(/PADRÕES_DETECTADOS:\n([\s\S]*?)(?=\nCÓDIGO_ORIGINAL:|$)/i);
  if (padroesMatch) {
    result.padroes = padroesMatch[1]
      .split('\n')
      .map(l => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }

  // Código original
  const origMatch = text.match(/CÓDIGO_ORIGINAL:\n```(?:javascript|js|typescript|ts)?\n([\s\S]*?)```/i);
  if (origMatch) result.codigoOriginal = origMatch[1].trim();

  // Código migrado
  const migMatch = text.match(/CÓDIGO_MIGRADO:\n```(?:javascript|js|typescript|ts)?\n([\s\S]*?)```/i);
  if (migMatch) result.codigoMigrado = migMatch[1].trim();

  // Mudanças
  const mudancasMatch = text.match(/MUDANÇAS:\n([\s\S]*?)(?=\nNOTAS:|$)/i);
  if (mudancasMatch) {
    result.mudancas = mudancasMatch[1]
      .split('\n')
      .map(l => l.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
  }

  // Notas
  const notasMatch = text.match(/NOTAS:\n?([\s\S]*?)$/i);
  if (notasMatch) result.notas = notasMatch[1].trim();

  return result;
}

export function parseAnalyzeResponse(text) {
  const result = {
    complexidade: '',
    padroes: [],
    dependencias: [],
    ordemSugerida: [],
    problemas: [],
    resumo: '',
    raw: text,
  };

  const complexMatch = text.match(/COMPLEXIDADE:\s*(.+)/i);
  if (complexMatch) result.complexidade = complexMatch[1].trim();

  const padroesMatch = text.match(/PADRÕES:\s*(.+)/i);
  if (padroesMatch) {
    result.padroes = padroesMatch[1].split(',').map(p => p.trim()).filter(Boolean);
  }

  const depsMatch = text.match(/DEPENDÊNCIAS:\n?([\s\S]*?)(?=\nORDEM_SUGERIDA:|$)/i);
  if (depsMatch) {
    result.dependencias = depsMatch[1].split('\n').map(l => l.replace(/^[-*\d.]\s*/, '').trim()).filter(Boolean);
  }

  const ordemMatch = text.match(/ORDEM_SUGERIDA:\n?([\s\S]*?)(?=\nPROBLEMAS:|$)/i);
  if (ordemMatch) {
    result.ordemSugerida = ordemMatch[1].split('\n').map(l => l.replace(/^[-*\d.]\s*/, '').trim()).filter(Boolean);
  }

  const problemasMatch = text.match(/PROBLEMAS:\n?([\s\S]*?)(?=\nRESUMO:|$)/i);
  if (problemasMatch) {
    result.problemas = problemasMatch[1].split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
  }

  const resumoMatch = text.match(/RESUMO:\n?([\s\S]*?)$/i);
  if (resumoMatch) result.resumo = resumoMatch[1].trim();

  return result;
}
