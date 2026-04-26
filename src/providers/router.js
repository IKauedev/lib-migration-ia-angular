/**
 * AI provider router.
 * Routes AI requests to the correct provider client and handles
 * single-turn and multi-turn conversations.
 */

import chalk from "chalk";
import { loadConfig, getProviderConfig, PROVIDERS } from "../utils/config-manager.js";
import {
    buildAnthropicClient,
    buildOpenAIClient,
    buildAzureOpenAIClient,
    buildOpenAICompatibleClient,
    buildOpenRouterClient,
    buildOllamaClient,
    buildGeminiClient,
} from "./clients.js";

// ── Key validation ────────────────────────────────────────────────────────────

function assertKey(cfg, providerName) {
    const meta = PROVIDERS[providerName];
    if (meta && meta.noKeyRequired) return;
    if (!cfg || !cfg.apiKey) {
        console.error(
            chalk.red(`\n  ✖ Nenhuma API key configurada para "${providerName}"!`),
        );
        console.error(chalk.dim("    Execute: ng-migrate config\n"));
        process.exit(1);
    }
}

// ── Single-turn ───────────────────────────────────────────────────────────────

/**
 * Send a single system+user message to the configured AI provider.
 * @param {string} systemPrompt
 * @param {string} userMessage
 * @param {{ provider?: string, maxTokens?: number }} opts
 * @returns {Promise<string>}
 */
export async function sendToProvider(systemPrompt, userMessage, opts = {}) {
    const config = loadConfig();
    const providerName = opts.provider || config.activeProvider;
    const cfg = getProviderConfig(config, providerName);
    assertKey(cfg, providerName);

    const maxTokens = opts.maxTokens || 4096;

    if (providerName === "anthropic") {
        const client = await buildAnthropicClient(cfg);
        const msg = await client.messages.create({
            model: cfg.model || "claude-opus-4-5",
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: "user", content: userMessage }],
        });
        return msg.content[0].text;
    }

    if (providerName === "openai") {
        const client = await buildOpenAIClient(cfg);
        const res = await client.chat.completions.create({
            model: cfg.model || "gpt-4o",
            max_tokens: maxTokens,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
        });
        return res.choices[0].message.content;
    }

    if (providerName === "azure-openai") {
        const client = await buildAzureOpenAIClient(cfg);
        const res = await client.chat.completions.create({
            model: cfg.deployment,
            max_tokens: maxTokens,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
        });
        return res.choices[0].message.content;
    }

    if (providerName === "openai-compatible") {
        const client = await buildOpenAICompatibleClient(cfg);
        const res = await client.chat.completions.create({
            model: cfg.model,
            max_tokens: maxTokens,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
        });
        return res.choices[0].message.content;
    }

    if (providerName === "openrouter") {
        const client = await buildOpenRouterClient(cfg);
        const res = await client.chat.completions.create({
            model: cfg.model || "anthropic/claude-opus-4-5",
            max_tokens: maxTokens,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
        });
        return res.choices[0].message.content;
    }

    if (providerName === "ollama") {
        const client = await buildOllamaClient(cfg);
        const res = await client.chat.completions.create({
            model: cfg.model || "llama3",
            max_tokens: maxTokens,
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userMessage },
            ],
        });
        return res.choices[0].message.content;
    }

    if (providerName === "gemini") {
        const genAI = await buildGeminiClient(cfg);
        const model = genAI.getGenerativeModel({
            model: cfg.model || "gemini-2.0-flash",
            systemInstruction: systemPrompt,
        });
        const result = await model.generateContent(userMessage);
        return result.response.text();
    }

    throw new Error(
        `Provedor desconhecido: "${providerName}". Execute ng-migrate config para configurar.`,
    );
}

// ── Multi-turn chat ───────────────────────────────────────────────────────────

/**
 * Send a multi-turn conversation to the configured AI provider.
 * @param {Array<{role: string, content: string}>} messages
 * @param {string} systemPrompt
 * @param {{ provider?: string, maxTokens?: number }} opts
 * @returns {Promise<string>}
 */
export async function sendChatToProvider(messages, systemPrompt, opts = {}) {
    const config = loadConfig();
    const providerName = opts.provider || config.activeProvider;
    const cfg = getProviderConfig(config, providerName);
    assertKey(cfg, providerName);

    const maxTokens = opts.maxTokens || 2048;

    if (providerName === "anthropic") {
        const client = await buildAnthropicClient(cfg);
        const msg = await client.messages.create({
            model: cfg.model || "claude-opus-4-5",
            max_tokens: maxTokens,
            system: systemPrompt,
            messages,
        });
        return msg.content[0].text;
    }

    if (
        providerName === "openai" ||
        providerName === "azure-openai" ||
        providerName === "openai-compatible" ||
        providerName === "openrouter" ||
        providerName === "ollama"
    ) {
        let client;
        if (providerName === "azure-openai") client = await buildAzureOpenAIClient(cfg);
        else if (providerName === "openai-compatible") client = await buildOpenAICompatibleClient(cfg);
        else if (providerName === "openrouter") client = await buildOpenRouterClient(cfg);
        else if (providerName === "ollama") client = await buildOllamaClient(cfg);
        else client = await buildOpenAIClient(cfg);

        const oaiMessages = [{ role: "system", content: systemPrompt }, ...messages];
        const res = await client.chat.completions.create({
            model: cfg.model || cfg.deployment || "gpt-4o",
            max_tokens: maxTokens,
            messages: oaiMessages,
        });
        return res.choices[0].message.content;
    }

    if (providerName === "gemini") {
        const genAI = await buildGeminiClient(cfg);
        const model = genAI.getGenerativeModel({
            model: cfg.model || "gemini-2.0-flash",
            systemInstruction: systemPrompt,
        });
        const history = messages.slice(0, -1).map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
        }));
        const chat = model.startChat({ history });
        const lastMsg = messages[messages.length - 1].content;
        const result = await chat.sendMessage(lastMsg);
        return result.response.text();
    }

    throw new Error(`Provedor desconhecido: "${providerName}".`);
}

// ── Active provider name ──────────────────────────────────────────────────────

export function getActiveProviderName() {
    return loadConfig().activeProvider;
}