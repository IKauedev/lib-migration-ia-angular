import chalk from "chalk";
import {
  loadConfig,
  getProviderConfig,
  PROVIDERS,
} from "../utils/config-manager.js";
import { dbgAI } from "../utils/debug.js";
import { MODEL_TIERS } from "../core/persona/migration-persona.js";



export const TASK_TYPES = {
  MIGRATION: "migration",
  ANALYSIS: "analysis",
  SCAN: "scan",
  CHAT: "chat",
};


const FAST_MODELS = {
  anthropic: "claude-haiku-3-5",
  openai: "gpt-4o-mini",
  openrouter: "anthropic/claude-haiku-3-5",

};



function extractAzureInstanceName(endpoint) {
  if (!endpoint) return "";
  const match = endpoint.match(/https?:\/\/([^.]+)\.openai\.azure\.com/i);
  return match ? match[1] : endpoint;
}



 
export async function buildModel(taskType = null, opts = {}) {
  const config = loadConfig();

  let providerName;
  let modelOverride = null;
  let taskHasExplicitModel = false;

  if (taskType && config.taskModels && config.taskModels[taskType]) {
    const taskCfg = config.taskModels[taskType];
    providerName = taskCfg.provider || config.activeProvider;
    modelOverride = taskCfg.model || null;
    taskHasExplicitModel = !!taskCfg.model;
  } else {
    providerName = config.activeProvider;
  }

  const cfg = getProviderConfig(config, providerName);
  const meta = PROVIDERS[providerName];
  const isNoKey = !!(meta && meta.noKeyRequired);

  if (!isNoKey && (!cfg || !cfg.apiKey)) {
    console.error(
      chalk.red(`\n  ✖ Nenhuma API key configurada para "${providerName}"!`),
    );
    console.error(chalk.dim("    Execute: ng-migrate config\n"));
    process.exit(1);
  }

  const maxTokens = opts.maxTokens !== undefined ? opts.maxTokens : 4096;
  const tier = opts.tier ?? MODEL_TIERS.STANDARD;


  const fastModel =
    !taskHasExplicitModel && tier === MODEL_TIERS.FAST
      ? FAST_MODELS[providerName]
      : null;

  const modelName = fastModel || modelOverride || (cfg && cfg.model);
  dbgAI(
    "modelo",
    providerName,
    `task=${taskType || "default"} | tier=${tier} | model=${modelName || "(padrão)"} | maxTokens=${maxTokens}`,
  );


  if (providerName === "anthropic") {
    const { ChatAnthropic } = await import("@langchain/anthropic");
    return new ChatAnthropic({
      apiKey: cfg.apiKey,
      model: modelName || "claude-opus-4-5",
      maxTokens,
    });
  }


  if (providerName === "openai") {
    const { ChatOpenAI } = await import("@langchain/openai");
    return new ChatOpenAI({
      apiKey: cfg.apiKey,
      model: modelName || "gpt-4o",
      maxTokens,
    });
  }


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


  if (providerName === "gemini") {
    const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
    return new ChatGoogleGenerativeAI({
      apiKey: cfg.apiKey,
      model: modelName || "gemini-2.0-flash",
      maxOutputTokens: maxTokens,
    });
  }


  if (providerName === "openrouter") {
    const { ChatOpenAI } = await import("@langchain/openai");
    return new ChatOpenAI({
      apiKey: cfg.apiKey,
      model: modelName || "anthropic/claude-opus-4-5",
      maxTokens,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer":
            "https://github.com/IKauedev/lib-migration-ia-angular",
          "X-Title": "ng-migrate-ai",
        },
      },
    });
  }


  if (providerName === "ollama") {
    const { ChatOpenAI } = await import("@langchain/openai");
    const endpoint = (cfg.endpoint || "http://localhost:11434").replace(
      /\/$/,
      "",
    );
    return new ChatOpenAI({
      apiKey: "ollama",
      model: modelName || "llama3",
      maxTokens,
      configuration: { baseURL: endpoint + "/v1" },
    });
  }


  if (providerName === "openai-compatible") {
    const { ChatOpenAI } = await import("@langchain/openai");
    return new ChatOpenAI({
      apiKey: (cfg && cfg.apiKey) || "none",
      model: modelName,
      maxTokens,
      configuration: { baseURL: cfg && cfg.endpoint },
    });
  }

  throw new Error(
    `Provedor desconhecido: "${providerName}". Execute ng-migrate config para configurar.`,
  );
}
