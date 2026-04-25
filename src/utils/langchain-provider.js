import chalk from "chalk";
import { loadConfig, getProviderConfig } from "./config-manager.js";
import { dbgAI } from "./debug.js";

// ── Task type constants ───────────────────────────────────────────────────────

export const TASK_TYPES = {
  MIGRATION: "migration",
  ANALYSIS: "analysis",
  SCAN: "scan",
  CHAT: "chat",
};

// ── Model builder ─────────────────────────────────────────────────────────────

/**
 * Builds a LangChain BaseChatModel for the given task type.
 * Respects per-task model overrides in config.taskModels[taskType].
 * Falls back to activeProvider when no override is set.
 *
 * @param {string|null} taskType  One of TASK_TYPES values (or null for default)
 * @param {{ maxTokens?: number }} opts
 * @returns {Promise<import("@langchain/core/language_models/chat_models").BaseChatModel>}
 */
export async function buildModel(taskType = null, opts = {}) {
  const config = loadConfig();

  let providerName;
  let modelOverride = null;

  // Per-task override wins over activeProvider
  if (taskType && config.taskModels?.[taskType]) {
    const taskCfg = config.taskModels[taskType];
    providerName = taskCfg.provider || config.activeProvider;
    modelOverride = taskCfg.model || null;
  } else {
    providerName = config.activeProvider;
  }

  const cfg = getProviderConfig(config, providerName);

  if (!cfg?.apiKey && providerName !== "openai-compatible") {
    console.error(
      chalk.red(`\n  ✖ Nenhuma API key configurada para "${providerName}"!`),
    );
    console.error(chalk.dim("    Execute: ng-migrate config\n"));
    process.exit(1);
  }

  const maxTokens = opts.maxTokens ?? 4096;
  const modelName = modelOverride ?? cfg?.model;
  dbgAI(
    "modelo",
    providerName,
    `task=${taskType ?? "default"} | model=${modelName ?? "(padrão)"} | maxTokens=${maxTokens}`,
  );
  // ── OpenAI ─────────────────────────────────────────────────────────────────
  if (providerName === "openai") {
    const { ChatOpenAI } = await import("@langchain/openai");
    return new ChatOpenAI({
      apiKey: cfg.apiKey,
      model: modelName || "gpt-4o",
      maxTokens,
    });
  }

  // ── Azure OpenAI ───────────────────────────────────────────────────────────
  if (providerName === "azure-openai") {
    const { AzureChatOpenAI } = await import("@langchain/openai");
    return new AzureChatOpenAI({
      azureOpenAIApiKey: cfg.apiKey,
      azureOpenAIApiInstanceName: extractAzureInstanceName(cfg.endpoint),
      azureOpenAIApiDeploymentName: modelOverride || cfg.deployment,
      azureOpenAIApiVersion: cfg.apiVersion || "2024-05-01-preview",
      maxTokens,
    });
  }

  // ── Anthropic ──────────────────────────────────────────────────────────────
  if (providerName === "anthropic") {
    const { ChatAnthropic } = await import("@langchain/anthropic");
    return new ChatAnthropic({
      apiKey: cfg.apiKey,
      model: modelName || "claude-opus-4-5",
      maxTokens,
    });
  }

  // ── Google Gemini ──────────────────────────────────────────────────────────
  if (providerName === "gemini") {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    return new ChatGoogleGenerativeAI({
      apiKey: cfg.apiKey,
      model: modelName || "gemini-2.0-flash",
      maxOutputTokens: maxTokens,
    });
  }

  // ── OpenAI-compatible (Groq, Together, Ollama, …) ─────────────────────────
  if (providerName === "openai-compatible") {
    const { ChatOpenAI } = await import("@langchain/openai");
    return new ChatOpenAI({
      apiKey: cfg.apiKey || "none",
      model: modelName,
      maxTokens,
      configuration: { baseURL: cfg.endpoint },
    });
  }

  throw new Error(
    `Provedor desconhecido: "${providerName}". Execute ng-migrate config para configurar.`,
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractAzureInstanceName(endpoint) {
  if (!endpoint) return "";
  // https://my-resource.openai.azure.com → my-resource
  const match = endpoint.match(/https?:\/\/([^.]+)\.openai\.azure\.com/i);
  return match ? match[1] : endpoint;
}
