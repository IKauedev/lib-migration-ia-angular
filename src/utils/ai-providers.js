/**
 * @deprecated
 * Re-exports from src/providers/ for backward compatibility.
 * New code should import directly from "../providers/router.js" or "../providers/clients.js".
 */
export {
    sendToProvider,
    sendChatToProvider,
    getActiveProviderName,
}
from "../providers/router.js";

export {
    buildAnthropicClient,
    buildOpenAIClient,
    buildAzureOpenAIClient,
    buildOpenAICompatibleClient,
    buildOpenRouterClient,
    buildOllamaClient,
    buildGeminiClient,
}
from "../providers/clients.js";