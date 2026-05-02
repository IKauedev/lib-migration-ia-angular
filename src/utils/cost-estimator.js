/**
 * cost-estimator.js
 * Estima tokens e custo de API antes de iniciar uma migração completa.
 * Baseado em contagem aproximada de tokens por caractere (1 token ≈ 4 chars).
 */

/**
 * @typedef {Object} ModelPricing
 * @property {string} provider
 * @property {string} model
 * @property {number} inputPer1M  - Preço por 1M tokens de entrada (USD)
 * @property {number} outputPer1M - Preço por 1M tokens de saída (USD)
 */

/** @type {ModelPricing[]} */
export const MODEL_PRICING = [
  // Anthropic
  {
    provider: "anthropic",
    model: "claude-opus-4-5",
    inputPer1M: 15.0,
    outputPer1M: 75.0,
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  {
    provider: "anthropic",
    model: "claude-haiku-4-5",
    inputPer1M: 0.25,
    outputPer1M: 1.25,
  },
  {
    provider: "anthropic",
    model: "claude-opus-4",
    inputPer1M: 15.0,
    outputPer1M: 75.0,
  },
  {
    provider: "anthropic",
    model: "claude-sonnet-4",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  {
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    inputPer1M: 3.0,
    outputPer1M: 15.0,
  },
  {
    provider: "anthropic",
    model: "claude-3-5-haiku",
    inputPer1M: 0.25,
    outputPer1M: 1.25,
  },
  {
    provider: "anthropic",
    model: "claude-3-opus",
    inputPer1M: 15.0,
    outputPer1M: 75.0,
  },
  // OpenAI
  { provider: "openai", model: "gpt-4o", inputPer1M: 2.5, outputPer1M: 10.0 },
  {
    provider: "openai",
    model: "gpt-4o-mini",
    inputPer1M: 0.15,
    outputPer1M: 0.6,
  },
  {
    provider: "openai",
    model: "gpt-4-turbo",
    inputPer1M: 10.0,
    outputPer1M: 30.0,
  },
  { provider: "openai", model: "gpt-4", inputPer1M: 30.0, outputPer1M: 60.0 },
  { provider: "openai", model: "o3", inputPer1M: 2.0, outputPer1M: 8.0 },
  { provider: "openai", model: "o4-mini", inputPer1M: 1.1, outputPer1M: 4.4 },
  // Google
  {
    provider: "gemini",
    model: "gemini-2.0-flash",
    inputPer1M: 0.075,
    outputPer1M: 0.3,
  },
  {
    provider: "gemini",
    model: "gemini-1.5-pro",
    inputPer1M: 1.25,
    outputPer1M: 5.0,
  },
  {
    provider: "gemini",
    model: "gemini-1.5-flash",
    inputPer1M: 0.075,
    outputPer1M: 0.3,
  },
  // Ollama / local — preço zero
  { provider: "ollama", model: "ollama", inputPer1M: 0.0, outputPer1M: 0.0 },
];

/**
 * Estima o número de tokens em uma string.
 * Regra prática: 1 token ≈ 4 caracteres para código inglês/português.
 *
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Encontra o preço de um modelo.
 * @param {string} provider
 * @param {string} model
 * @returns {ModelPricing|undefined}
 */
export function findPricing(provider, model) {
  const p = (provider || "").toLowerCase();
  const m = (model || "").toLowerCase();
  return (
    MODEL_PRICING.find((mp) => mp.provider === p && m.includes(mp.model)) ||
    MODEL_PRICING.find((mp) => mp.provider === p)
  );
}

/**
 * @typedef {Object} CostEstimate
 * @property {number} totalFiles
 * @property {number} totalChars
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} totalTokens
 * @property {number} estimatedUSD
 * @property {string} formattedCost
 * @property {string} provider
 * @property {string} model
 * @property {string[]} warnings
 */

/**
 * Estima o custo total de migrar um conjunto de arquivos.
 *
 * @param {Array<{path: string, loc: number, complexity: string}>} files
 * @param {string} provider - Provedor de IA configurado
 * @param {string} model - Modelo configurado
 * @returns {CostEstimate}
 */
export function estimateMigrationCost(files, provider, model) {
  const PROMPT_OVERHEAD_TOKENS = 800; // tokens fixos no prompt de sistema
  const OUTPUT_RATIO = 1.4; // output é ~40% maior que input (código + explicações)

  let totalChars = 0;
  let totalFiles = 0;
  const warnings = [];

  for (const f of files) {
    // Estimativa por LOC se não tiver o código completo
    const loc = f.loc || 100;
    const avgCharsPerLine = 45;
    totalChars += loc * avgCharsPerLine;
    totalFiles++;
  }

  const inputTokensPerFile =
    estimateTokens(
      "x".repeat(Math.ceil(totalChars / Math.max(totalFiles, 1))),
    ) + PROMPT_OVERHEAD_TOKENS;
  const inputTokens = inputTokensPerFile * totalFiles;
  const outputTokens = Math.ceil(inputTokens * OUTPUT_RATIO);
  const totalTokens = inputTokens + outputTokens;

  const pricing = findPricing(provider, model);
  let estimatedUSD = 0;
  let formattedCost = "gratuito (modelo local)";

  if (pricing) {
    const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
    const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
    estimatedUSD = inputCost + outputCost;

    if (pricing.inputPer1M === 0) {
      formattedCost = "gratuito (modelo local)";
    } else if (estimatedUSD < 0.01) {
      formattedCost = "< $0.01";
    } else if (estimatedUSD < 1) {
      formattedCost = `~$${estimatedUSD.toFixed(3)}`;
    } else {
      formattedCost = `~$${estimatedUSD.toFixed(2)}`;
    }
  } else {
    warnings.push(
      `Preço não encontrado para ${provider}/${model} — usando estimativa zero.`,
    );
    formattedCost = "desconhecido";
  }

  // Warnings para projetos grandes
  if (totalTokens > 500_000) {
    warnings.push(
      `Projeto grande: ~${_formatTokens(totalTokens)} tokens — considere usar --phase para migrar por partes.`,
    );
  }
  if (estimatedUSD > 10) {
    warnings.push(
      `Custo estimado alto (${formattedCost}) — verifique o número de arquivos ou use um modelo mais econômico.`,
    );
  }

  return {
    totalFiles,
    totalChars,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedUSD,
    formattedCost,
    provider: provider || "desconhecido",
    model: model || "desconhecido",
    warnings,
  };
}

/**
 * Estima o custo para um único arquivo (dado o código completo).
 *
 * @param {string} code - Código completo do arquivo
 * @param {string} provider
 * @param {string} model
 * @returns {CostEstimate}
 */
export function estimateSingleFileCost(code, provider, model) {
  const PROMPT_OVERHEAD_TOKENS = 800;
  const OUTPUT_RATIO = 1.4;

  const inputTokens = estimateTokens(code) + PROMPT_OVERHEAD_TOKENS;
  const outputTokens = Math.ceil(inputTokens * OUTPUT_RATIO);
  const totalTokens = inputTokens + outputTokens;
  const warnings = [];

  const pricing = findPricing(provider, model);
  let estimatedUSD = 0;
  let formattedCost = "gratuito";

  if (pricing && pricing.inputPer1M > 0) {
    estimatedUSD =
      (inputTokens / 1_000_000) * pricing.inputPer1M +
      (outputTokens / 1_000_000) * pricing.outputPer1M;
    formattedCost =
      estimatedUSD < 0.01 ? "< $0.01" : `~$${estimatedUSD.toFixed(4)}`;
  }

  return {
    totalFiles: 1,
    totalChars: code.length,
    inputTokens,
    outputTokens,
    totalTokens,
    estimatedUSD,
    formattedCost,
    provider: provider || "desconhecido",
    model: model || "desconhecido",
    warnings,
  };
}

/**
 * Formata um número de tokens de forma legível.
 * @param {number} n
 * @returns {string}
 */
function _formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/**
 * Formata o resumo de estimativa de custo para exibição no CLI.
 *
 * @param {CostEstimate} estimate
 * @returns {string[]} Linhas para imprimir
 */
export function formatCostEstimate(estimate) {
  const lines = [
    `  Arquivos:       ${estimate.totalFiles}`,
    `  Tokens totais:  ~${_formatTokens(estimate.totalTokens)} (entrada: ${_formatTokens(estimate.inputTokens)} + saída: ${_formatTokens(estimate.outputTokens)})`,
    `  Provedor:       ${estimate.provider} / ${estimate.model}`,
    `  Custo estimado: ${estimate.formattedCost}`,
  ];

  for (const w of estimate.warnings) {
    lines.push(`  ⚠  ${w}`);
  }

  return lines;
}
