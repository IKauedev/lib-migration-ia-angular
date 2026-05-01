export async function buildAnthropicClient(cfg) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  return new Anthropic({ apiKey: cfg.apiKey });
}

export async function buildOpenAIClient(cfg) {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({ apiKey: cfg.apiKey });
}

export async function buildAzureOpenAIClient(cfg) {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: `${cfg.endpoint}/openai/deployments/${cfg.deployment}`,
    defaultQuery: { "api-version": cfg.apiVersion || "2024-05-01-preview" },
    defaultHeaders: { "api-key": cfg.apiKey },
  });
}

export async function buildOpenAICompatibleClient(cfg) {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    apiKey: cfg.apiKey || "none",
    baseURL: cfg.endpoint,
  });
}

export async function buildOpenRouterClient(cfg) {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    apiKey: cfg.apiKey,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://github.com/IKauedev/lib-migration-ia-angular",
      "X-Title": "ng-migrate-angularjs-ai",
    },
  });
}

export async function buildOllamaClient(cfg) {
  const { default: OpenAI } = await import("openai");
  return new OpenAI({
    apiKey: "ollama",
    baseURL:
      (cfg.endpoint || "http://localhost:11434").replace(/\/$/, "") + "/v1",
  });
}

export async function buildGeminiClient(cfg) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  return new GoogleGenerativeAI(cfg.apiKey);
}
