/**
 * chunk-migrator.js
 * Divide arquivos grandes em chunks semânticos para evitar ultrapassar
 * o limite de tokens da IA, e reagrupa o resultado.
 */

import { dbg } from "./debug.js";

/** Limite de caracteres por chunk (aprox. 800 linhas) */
export const CHUNK_SIZE_CHARS = 32_000;

/** Mínimo para considerar chunking necessário */
export const MIN_CHUNK_THRESHOLD = 40_000;

/**
 * Verifica se o código precisa de chunking.
 * @param {string} code
 * @returns {boolean}
 */
export function needsChunking(code) {
  return code.length > MIN_CHUNK_THRESHOLD;
}

/**
 * Divide o código em chunks semânticos preservando contexto.
 * Tenta dividir em fronteiras de função/classe/bloco.
 *
 * @param {string} code - Código fonte completo
 * @param {number} maxChunkSize - Tamanho máximo de cada chunk em caracteres
 * @returns {Array<{index: number, content: string, startLine: number, endLine: number}>}
 */
export function splitIntoChunks(code, maxChunkSize = CHUNK_SIZE_CHARS) {
  if (!needsChunking(code)) {
    return [
      { index: 0, content: code, startLine: 1, endLine: countLines(code) },
    ];
  }

  const lines = code.split("\n");
  const chunks = [];
  let currentChunkLines = [];
  let currentSize = 0;
  let chunkStartLine = 1;
  let lineNumber = 1;

  // Divisores semânticos em ordem de preferência
  const STRONG_SPLIT_PATTERNS = [
    /^(export\s+)?(default\s+)?(abstract\s+)?class\s+\w+/,
    /^(export\s+)?(async\s+)?function\s+\w+/,
    /^\/\/\s*={3,}/, // comment separator lines: // ===
    /^\/\*{2,}/, // JSDoc blocks
  ];

  const WEAK_SPLIT_PATTERNS = [
    /^}\s*$/, // closing brace on its own line
    /^$\s*$/, // empty line
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineSize = line.length + 1; // +1 for \n

    const isStrongBoundary = STRONG_SPLIT_PATTERNS.some((p) =>
      p.test(line.trim()),
    );
    const isWeakBoundary = WEAK_SPLIT_PATTERNS.some((p) => p.test(line.trim()));

    // Split if chunk is too large AND we're at a good boundary
    if (currentSize + lineSize > maxChunkSize && currentChunkLines.length > 0) {
      if (
        isStrongBoundary ||
        (isWeakBoundary && currentSize > maxChunkSize * 0.7)
      ) {
        chunks.push({
          index: chunks.length,
          content: currentChunkLines.join("\n"),
          startLine: chunkStartLine,
          endLine: lineNumber - 1,
        });
        chunkStartLine = lineNumber;
        currentChunkLines = [];
        currentSize = 0;
      }
    }

    currentChunkLines.push(line);
    currentSize += lineSize;
    lineNumber++;
  }

  // Last chunk
  if (currentChunkLines.length > 0) {
    chunks.push({
      index: chunks.length,
      content: currentChunkLines.join("\n"),
      startLine: chunkStartLine,
      endLine: lineNumber - 1,
    });
  }

  dbg(
    `[chunk-migrator] código dividido em ${chunks.length} chunks (total: ${code.length} chars)`,
  );
  return chunks;
}

/**
 * Mescla os resultados de migração de múltiplos chunks em um único arquivo.
 * Combina imports, remove duplicatas e concatena as classes/funções.
 *
 * @param {Array<{codigoMigrado: string, mudancas: string[], notas: string}>} results
 * @returns {{codigoMigrado: string, mudancas: string[], notas: string}}
 */
export function mergeChunkResults(results) {
  if (results.length === 0)
    return { codigoMigrado: "", mudancas: [], notas: "" };
  if (results.length === 1) return results[0];

  const allImports = new Set();
  const bodyParts = [];
  const allMudancas = [];
  const allNotas = [];

  for (const result of results) {
    if (!result.codigoMigrado) continue;

    const { imports, body } = separateImports(result.codigoMigrado);
    for (const imp of imports) allImports.add(imp.trim());
    if (body.trim()) bodyParts.push(body.trim());
    if (result.mudancas?.length) allMudancas.push(...result.mudancas);
    if (result.notas) allNotas.push(result.notas);
  }

  const codigoMigrado = [[...allImports].join("\n"), "", bodyParts.join("\n\n")]
    .join("\n")
    .trim();

  return {
    codigoMigrado,
    mudancas: [...new Set(allMudancas)],
    notas: allNotas.filter(Boolean).join("; "),
  };
}

/**
 * Separa as linhas de import do corpo do código.
 */
function separateImports(code) {
  const lines = code.split("\n");
  const importLines = [];
  const bodyLines = [];
  let pastImports = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !pastImports &&
      (trimmed.startsWith("import ") || trimmed.startsWith("import{"))
    ) {
      importLines.push(line);
    } else {
      pastImports = true;
      bodyLines.push(line);
    }
  }

  return { imports: importLines, body: bodyLines.join("\n") };
}

/**
 * Cria um prompt de contexto que indica ao AI que é um chunk de um arquivo maior.
 */
export function buildChunkContext(chunk, totalChunks, fileInfo) {
  return [
    `ATENÇÃO: Este é o chunk ${chunk.index + 1} de ${totalChunks} de um arquivo grande.`,
    `Linhas ${chunk.startLine}–${chunk.endLine} do arquivo original.`,
    `Arquivo: ${fileInfo?.path || "desconhecido"} | Tipo: ${fileInfo?.type || "auto"}`,
    `Migre APENAS este trecho. Mantenha os imports necessários para este chunk.`,
    `Se uma classe/função estiver incompleta, inclua apenas a parte presente neste chunk.`,
  ].join("\n");
}

function countLines(code) {
  return (code.match(/\n/g) || []).length + 1;
}
