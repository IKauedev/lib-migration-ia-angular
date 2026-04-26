/**
 * LangChain model factory.
 * Builds a BaseChatModel for the active or per-task AI provider.
 * Adds OpenRouter and Ollama support on top of the original provider set.
 */

import chalk from "chalk";
import { loadConfig, getProviderConfig, PROVIDERS } from "../utils/config-manager.js";
import { dbgAI } from "../utils/debug.js";

// ── Task type constants ───────────────────────────────────────────────────────

export const TASK_TYPES = {
    MIGRATION: "migration",
    ANALYSIS: "analysis",
    SCAN: "scan",
    CHAT: "chat",
};

// ── Azure instance name helper ────────────────────────────────────────────────


function extractAzureInstanceName(endpoint) {
    if (!endpoint) return "";
    const match = endpoint.match(/https?:\/\/([^.]+)\.openai\.azure\.com/i);
    return match ? match[1] : endpoint;
}

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

    if (taskType && config.taskModels && config.taskModels[taskType]) {
        const taskCfg = config.taskModels[taskType];
        providerName = taskCfg.provider || config.activeProvider;
        modelOverride = taskCfg.model || null;
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
    const modelName = modelOverride || (cfg && cfg.model);
    dbgAI(
        "modelo",
        providerName,
        `task=${taskType || "default"} | model=${modelName || "(padrão)"} | maxTokens=${maxTokens}`,
    );

    // ── Anthropic ──────────────────────────────────────────────────────────────
    if (providerName === "anthropic") {
        const { ChatAnthropic } = await
        import ("@langchain/anthropic");
        return new ChatAnthropic({
            apiKey: cfg.apiKey,
            model: modelName || "claude-opus-4-5",
            maxTokens,
        });
    }

    // ── OpenAI ─────────────────────────────────────────────────────────────────
    if (providerName === "openai") {
        const { ChatOpenAI } = await
        import ("@langchain/openai");
        return new ChatOpenAI({
            apiKey: cfg.apiKey,
            model: modelName || "gpt-4o",
            maxTokens,
        });
    }

    // ── Azure OpenAI ───────────────────────────────────────────────────────────
    if (providerName === "azure-openai") {
        const { AzureChatOpenAI } = await
        import ("@langchain/openai");
        return new AzureChatOpenAI({
            azureOpenAIApiKey: cfg.apiKey,
            azureOpenAIApiInstanceName: extractAzureInstanceName(cfg.endpoint),
            azureOpenAIApiDeploymentName: modelOverride || cfg.deployment,
            azureOpenAIApiVersion: cfg.apiVersion || "2024-05-01-preview",
            maxTokens,
        });
    }

    // ── Google Gemini ──────────────────────────────────────────────────────────
    if (providerName === "gemini") {
        const { ChatGoogleGenerativeAI } = await
        import ("@langchain/google-genai");
        return new ChatGoogleGenerativeAI({
            apiKey: cfg.apiKey,
            model: modelName || "gemini-2.0-flash",
            maxOutputTokens: maxTokens,
        });
    }

    // ── OpenRouter ─────────────────────────────────────────────────────────────
    if (providerName === "openrouter") {
        const { ChatOpenAI } = await
        import ("@langchain/openai");
        return new ChatOpenAI({
            apiKey: cfg.apiKey,
            model: modelName || "anthropic/claude-opus-4-5",
            maxTokens,
            configuration: {
                baseURL: "https://openrouter.ai/api/v1",
                defaultHeaders: {
                    "HTTP-Referer": "https://github.com/IKauedev/lib-migration-ia-angular",
                    "X-Title": "ng-migrate-ai",
                },
            },
        });
    }

    // ── Ollama ─────────────────────────────────────────────────────────────────
    if (providerName === "ollama") {
        const { ChatOpenAI } = await
        import ("@langchain/openai");
        const endpoint = (cfg.endpoint || "http://localhost:11434").replace(/\/$/, "");
        return new ChatOpenAI({
            apiKey: "ollama",
            model: modelName || "llama3",
            maxTokens,
            configuration: { baseURL: endpoint + "/v1" },
        });
    }

    // ── OpenAI-compatible (Groq, Together, etc.) ───────────────────────────────
    if (providerName === "openai-compatible") {
        const { ChatOpenAI } = await
        import ("@langchain/openai");
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