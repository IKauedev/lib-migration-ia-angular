export function parseMigrateResponse(input) {

  if (typeof input === "object" && input !== null) {
    return {
      tipo: input.tipo || "",
      padroes: input.padroes || [],
      codigoOriginal: input.codigoOriginal || "",
      codigoMigrado: input.codigoMigrado || "",
      mudancas: input.mudancas || [],
      notas: input.notas || "",
      raw: input,
    };
  }


  const result = {
    tipo: "",
    padroes: [],
    codigoOriginal: "",
    codigoMigrado: "",
    mudancas: [],
    notas: "",
    raw: input,
  };

  const text = input;


  const tipoMatch = text.match(/TIPO:\s*(.+)/i);
  if (tipoMatch) result.tipo = tipoMatch[1].trim();


  const padroesMatch = text.match(
    /PADRÕES_DETECTADOS:\n([\s\S]*?)(?=\nCÓDIGO_ORIGINAL:|$)/i,
  );
  if (padroesMatch) {
    result.padroes = padroesMatch[1]
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }


  const origMatch = text.match(
    /CÓDIGO_ORIGINAL:\n```(?:javascript|js|typescript|ts)?\n([\s\S]*?)```/i,
  );
  if (origMatch) result.codigoOriginal = origMatch[1].trim();


  const migMatch = text.match(
    /CÓDIGO_MIGRADO:\n```(?:javascript|js|typescript|ts)?\n([\s\S]*?)```/i,
  );
  if (migMatch) result.codigoMigrado = migMatch[1].trim();


  const mudancasMatch = text.match(/MUDANÇAS:\n([\s\S]*?)(?=\nNOTAS:|$)/i);
  if (mudancasMatch) {
    result.mudancas = mudancasMatch[1]
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }


  const notasMatch = text.match(/NOTAS:\n?([\s\S]*?)$/i);
  if (notasMatch) result.notas = notasMatch[1].trim();

  return result;
}

export function parseAnalyzeResponse(input) {

  if (typeof input === "object" && input !== null) {
    return {
      complexidade: input.complexidade || "",
      padroes: input.padroes || [],
      dependencias: input.dependencias || [],
      ordemSugerida: input.ordemSugerida || [],
      problemas: input.problemas || [],
      resumo: input.resumo || "",
      raw: input,
    };
  }


  const text = input;
  const result = {
    complexidade: "",
    padroes: [],
    dependencias: [],
    ordemSugerida: [],
    problemas: [],
    resumo: "",
    raw: text,
  };

  const complexMatch = text.match(/COMPLEXIDADE:\s*(.+)/i);
  if (complexMatch) result.complexidade = complexMatch[1].trim();

  const padroesMatch = text.match(/PADRÕES:\s*(.+)/i);
  if (padroesMatch) {
    result.padroes = padroesMatch[1]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
  }

  const depsMatch = text.match(
    /DEPENDÊNCIAS:\n?([\s\S]*?)(?=\nORDEM_SUGERIDA:|$)/i,
  );
  if (depsMatch) {
    result.dependencias = depsMatch[1]
      .split("\n")
      .map((l) => l.replace(/^[-*\d.]\s*/, "").trim())
      .filter(Boolean);
  }

  const ordemMatch = text.match(
    /ORDEM_SUGERIDA:\n?([\s\S]*?)(?=\nPROBLEMAS:|$)/i,
  );
  if (ordemMatch) {
    result.ordemSugerida = ordemMatch[1]
      .split("\n")
      .map((l) => l.replace(/^[-*\d.]\s*/, "").trim())
      .filter(Boolean);
  }

  const problemasMatch = text.match(/PROBLEMAS:\n?([\s\S]*?)(?=\nRESUMO:|$)/i);
  if (problemasMatch) {
    result.problemas = problemasMatch[1]
      .split("\n")
      .map((l) => l.replace(/^[-*]\s*/, "").trim())
      .filter(Boolean);
  }

  const resumoMatch = text.match(/RESUMO:\n?([\s\S]*?)$/i);
  if (resumoMatch) result.resumo = resumoMatch[1].trim();

  return result;
}
