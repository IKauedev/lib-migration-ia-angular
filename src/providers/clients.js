/**
 * AI provider client builders.
 * Each function lazily imports the required SDK and returns an initialised client.
 */

/**
 * @param {{ apiKey: string }} cfg
 */
export async function buildAnthropicClient(cfg) {
    const { default: Anthropic } = await
    import ("@anthropic-ai/sdk");
    return new Anthropic({ apiKey: cfg.apiKey });
}

/**
 * @param {{ apiKey: string }} cfg
 */
export async function buildOpenAIClient(cfg) {
    const { default: OpenAI } = await
    import ("openai");
    return new OpenAI({ apiKey: cfg.apiKey });
}

/**
 * @param {{ apiKey: string, endpoint: string, deployment: string, apiVersion?: string }} cfg
 */
export async function buildAzureOpenAIClient(cfg) {
    const { default: OpenAI } = await
    import ("openai");
    return new OpenAI({
        apiKey: cfg.apiKey,
        baseURL: `${cfg.endpoint}/openai/deployments/${cfg.deployment}`,
        defaultQuery: { "api-version": cfg.apiVersion || "2024-05-01-preview" },
        defaultHeaders: { "api-key": cfg.apiKey },
    });
}

/**
 * @param {{ apiKey?: string, endpoint: string }} cfg
 */
export async function buildOpenAICompatibleClient(cfg) {
    const { default: OpenAI } = await
    import ("openai");
    return new OpenAI({
        apiKey: cfg.apiKey || "none",
        baseURL: cfg.endpoint,
    });
}

/**
 * @param {{ apiKey: string }} cfg
 */
export async function buildOpenRouterClient(cfg) {
    const { default: OpenAI } = await
    import ("openai");
    return new OpenAI({
        apiKey: cfg.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
            "HTTP-Referer": "https://github.com/IKauedev/lib-migration-ia-angular",
            "X-Title": "ng-migrate-ai",
        },
    });
}

/**
 * @param {{ endpoint?: string }} cfg
 */
export async function buildOllamaClient(cfg) {
    const { default: OpenAI } = await
    import ("openai");
    return new OpenAI({
        apiKey: "ollama",
        baseURL: (cfg.endpoint || "http://localhost:11434").replace(/\/$/, "") + "/v1",
    });
}

/**
 * @param {{ apiKey: string }} cfg
 */
export async function buildGeminiClient(cfg) {
    const { GoogleGenerativeAI } = await
    import ("@google/generative-ai");
    return new GoogleGenerativeAI(cfg.apiKey);
}