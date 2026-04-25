import chalk from "chalk";
import { loadConfig, getProviderConfig } from "./config-manager.js";

// ── Lazy provider builders ────────────────────────────────────────────────────

async function buildAnthropicClient(cfg) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey: cfg.apiKey });
}

async function buildOpenAIClient(cfg) {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: cfg.apiKey });
}

async function buildAzureOpenAIClient(cfg) {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: `${cfg.endpoint}/openai/deployments/${cfg.deployment}`,
    defaultQuery: { "api-version": cfg.apiVersion || "2024-05-01-preview" },
    defaultHeaders: { "api-key": cfg.apiKey },
  });
}

async function buildOpenAICompatibleClient(cfg) {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    apiKey: cfg.apiKey || "none",
    baseURL: cfg.endpoint,
  });
}

async function buildGeminiClient(cfg) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  return new GoogleGenerativeAI(cfg.apiKey);
}

// ── Validate config ───────────────────────────────────────────────────────────

function assertKey(cfg, providerName) {
  if (!cfg?.apiKey) {
    console.error(
      chalk.red(`\n  ✖ Nenhuma API key configurada para "${providerName}"!`),
    );
    console.error(chalk.dim("    Execute: ng-migrate config\n"));
    process.exit(1);
  }
}

// ── Single message ────────────────────────────────────────────────────────────

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
 * @param {Array<{role: string, content: string}>} messages  Anthropic-style messages
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
    providerName === "openai-compatible"
  ) {
    let client;
    if (providerName === "azure-openai")
      client = await buildAzureOpenAIClient(cfg);
    else if (providerName === "openai-compatible")
      client = await buildOpenAICompatibleClient(cfg);
    else client = await buildOpenAIClient(cfg);

    const oaiMessages = [
      { role: "system", content: systemPrompt },
      ...messages,
    ];
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
    // All but last message go into history
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

export function getActiveProviderName() {
  return loadConfig().activeProvider;
}
