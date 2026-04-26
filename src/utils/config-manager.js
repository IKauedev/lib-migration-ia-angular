import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".ng-migrate");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

export const PROVIDERS = {
  anthropic: {
    name: "Anthropic (Claude)",
    models: [
      "claude-opus-4-5",
      "claude-3-5-sonnet-20241022",
      "claude-3-haiku-20240307",
    ],
    fields: ["apiKey", "model"],
    envKey: "ANTHROPIC_API_KEY",
  },
  openai: {
    name: "OpenAI (GPT)",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
    fields: ["apiKey", "model"],
    envKey: "OPENAI_API_KEY",
  },
  "azure-openai": {
    name: "Azure OpenAI",
    models: [],
    fields: ["apiKey", "endpoint", "deployment", "apiVersion"],
    envKey: "AZURE_OPENAI_KEY",
  },
  gemini: {
    name: "Google Gemini",
    models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    fields: ["apiKey", "model"],
    envKey: "GOOGLE_API_KEY",
  },
  "openai-compatible": {
    name: "OpenAI-Compatible (Groq, Together, etc.)",
    models: [],
    fields: ["apiKey", "endpoint", "model"],
    envKey: null,
  },
  openrouter: {
    name: "OpenRouter",
    models: [
      "anthropic/claude-opus-4-5",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "meta-llama/llama-3.3-70b-instruct",
      "google/gemini-2.0-flash-001",
      "mistralai/mixtral-8x22b-instruct",
      "deepseek/deepseek-r1",
      "qwen/qwen-2.5-coder-32b-instruct",
    ],
    fields: ["apiKey", "model"],
    envKey: "OPENROUTER_API_KEY",
  },
  ollama: {
    name: "Ollama (local)",
    models: [
      "llama3",
      "llama3.1",
      "mistral",
      "codellama",
      "phi3",
      "gemma2",
      "qwen2.5-coder",
    ],
    fields: ["endpoint", "model"],
    envKey: null,
    noKeyRequired: true,
  },
};

export const TASK_LABELS = {
  migration: "Migração de arquivo (migrate)",
  analysis: "Análise de arquivo/projeto (analyze)",
  scan: "Varredura com IA (scan --ai)",
  chat: "REPL interativo (repl)",
};

const DEFAULT_CONFIG = {
  activeProvider: "anthropic",
  providers: {
    anthropic: { model: "claude-opus-4-5" },
  },
  taskModels: {}, // empty = use activeProvider for all tasks
};

export function loadConfig() {
  const config = {
    activeProvider: DEFAULT_CONFIG.activeProvider,
    providers: { ...DEFAULT_CONFIG.providers },
  };

  // Load from file
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      config.activeProvider = saved.activeProvider || config.activeProvider;
      config.providers = { ...config.providers, ...saved.providers };
      config.taskModels = saved.taskModels ? { ...saved.taskModels } : {};
    }
  } catch {
    /* use defaults */
  }

  // Inject env-var API keys as fallback (never override file config)
  const envMappings = [
    ["anthropic", "ANTHROPIC_API_KEY", { model: "claude-opus-4-5" }],
    ["openai", "OPENAI_API_KEY", { model: "gpt-4o" }],
    ["azure-openai", "AZURE_OPENAI_KEY", {}],
    ["gemini", "GOOGLE_API_KEY", { model: "gemini-2.0-flash" }],
    [
      "openrouter",
      "OPENROUTER_API_KEY",
      { model: "anthropic/claude-opus-4-5" },
    ],
  ];

  for (const [name, envVar, defaults] of envMappings) {
    const envVal = process.env[envVar];
    if (envVal && !config.providers[name]?.apiKey) {
      config.providers[name] = {
        ...defaults,
        ...config.providers[name],
        apiKey: envVal,
      };
    }
  }

  // Extra Azure env vars
  if (
    config.providers["azure-openai"] &&
    !config.providers["azure-openai"].endpoint
  ) {
    if (process.env.AZURE_OPENAI_ENDPOINT)
      config.providers["azure-openai"].endpoint =
        process.env.AZURE_OPENAI_ENDPOINT;
    if (process.env.AZURE_OPENAI_DEPLOYMENT)
      config.providers["azure-openai"].deployment =
        process.env.AZURE_OPENAI_DEPLOYMENT;
    if (process.env.AZURE_OPENAI_API_VERSION)
      config.providers["azure-openai"].apiVersion =
        process.env.AZURE_OPENAI_API_VERSION;
  }

  // Inject OLLAMA_HOST env var
  if (process.env.OLLAMA_HOST && !config.providers.ollama?.endpoint) {
    config.providers.ollama = {
      model: "llama3",
      ...config.providers.ollama,
      endpoint: process.env.OLLAMA_HOST,
    };
  }

  // Auto-detect active provider from available keys if the configured one has no key
  const activeCfg = config.providers[config.activeProvider];
  const activeOk =
    activeCfg?.apiKey ||
    (PROVIDERS[config.activeProvider]?.noKeyRequired &&
      (activeCfg?.endpoint || activeCfg?.model));

  if (!activeOk) {
    const order = [
      "anthropic",
      "openai",
      "azure-openai",
      "gemini",
      "openrouter",
      "openai-compatible",
      "ollama",
    ];
    const found = order.find((p) => {
      const pcfg = config.providers[p];
      if (!pcfg) return false;
      if (PROVIDERS[p]?.noKeyRequired) return !!(pcfg.endpoint || pcfg.model);
      return !!pcfg.apiKey;
    });
    if (found) config.activeProvider = found;
  }

  return config;
}

export function saveConfig(config) {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), "utf-8");
}

export function getProviderConfig(config, providerName) {
  return config.providers[providerName || config.activeProvider];
}

/**
 * Returns provider-specific validation errors (endpoint, deployment, etc.).
 * Extracted to keep assertReadyToMigrate below complexity threshold.
 */
function providerSpecificErrors(provider, provCfg) {
  const errors = [];
  if (provider === "azure-openai") {
    if (!provCfg.endpoint)
      errors.push(
        "Azure OpenAI: endpoint não configurado. Execute ng-migrate config.",
      );
    if (!provCfg.deployment)
      errors.push(
        "Azure OpenAI: deployment não configurado. Execute ng-migrate config.",
      );
  }
  if (provider === "ollama" && !provCfg.endpoint) {
    errors.push(
      "Ollama: endpoint não configurado (ex: http://localhost:11434). Execute ng-migrate config.",
    );
  }
  return errors;
}

/**
 * Verifies that the active provider is fully configured before a migration.
 * Returns { ok: true } on success, or { ok: false, errors: string[] } on failure.
 */
export function assertReadyToMigrate() {
  let config;
  try {
    config = loadConfig();
  } catch {
    return {
      ok: false,
      errors: [
        "Não foi possível ler a configuração (~/.ng-migrate/config.json).",
      ],
    };
  }

  const provider = config.activeProvider;
  const provDef = PROVIDERS[provider];
  const provCfg = config.providers?.[provider];

  if (!provDef)
    return {
      ok: false,
      errors: [
        `Provedor desconhecido: "${provider}". Execute ng-migrate config.`,
      ],
    };

  if (!provCfg)
    return {
      ok: false,
      errors: [
        `Provedor "${provDef.name}" não está configurado. Execute ng-migrate config.`,
      ],
    };

  const errors = [];

  if (!provDef.noKeyRequired && !provCfg.apiKey) {
    const envHint = provDef.envKey
      ? ` (ou defina ${provDef.envKey} no ambiente)`
      : "";
    errors.push(
      `Chave de API ausente para "${provDef.name}"${envHint}. Execute ng-migrate config.`,
    );
  }

  if (!provCfg.model && provDef.models?.length > 0) {
    errors.push(
      `Modelo não definido para "${provDef.name}". Execute ng-migrate config.`,
    );
  }

  errors.push(...providerSpecificErrors(provider, provCfg));

  if (errors.length > 0) return { ok: false, errors };
  return {
    ok: true,
    summary:
      `${provDef.name} · ${provCfg.model || provCfg.deployment || ""}`.replace(
        / · $/,
        "",
      ),
  };
}

export const CONFIG_FILE_PATH = CONFIG_FILE;
