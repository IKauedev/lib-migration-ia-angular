import chalk from "chalk";
import ora from "ora";
import {
  loadConfig,
  saveConfig,
  PROVIDERS,
  CONFIG_FILE_PATH,
} from "../utils/config-manager.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";

export async function configCommand(opts) {
  // ── Show current config ─────────────────────────────────────────────────────
  if (opts.show) {
    showCurrentConfig();
    return;
  }

  // ── Reset ───────────────────────────────────────────────────────────────────
  if (opts.reset) {
    const { default: inquirer } = await import("inquirer");
    const { confirm } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirm",
        message: "Tem certeza que deseja redefinir todas as configurações?",
        default: false,
      },
    ]);
    if (confirm) {
      saveConfig({ activeProvider: "anthropic", providers: {} });
      ui.success("Configuração redefinida.");
    }
    return;
  }

  // ── Interactive setup ───────────────────────────────────────────────────────
  const { default: inquirer } = await import("inquirer");

  ui.section("Configuração de Provedores de IA");
  console.log(chalk.dim(`  Configurações salvas em: ${CONFIG_FILE_PATH}\n`));

  const config = loadConfig();

  // Step 1 — Choose provider
  const { providerKey } = await inquirer.prompt([
    {
      type: "list",
      name: "providerKey",
      message: "Selecione o provedor de IA:",
      choices: Object.entries(PROVIDERS).map(([key, val]) => ({
        name: `${val.name}${config.activeProvider === key ? chalk.green("  ✔ ativo") : ""}`,
        value: key,
      })),
    },
  ]);

  const provider = PROVIDERS[providerKey];
  const current = config.providers[providerKey] || {};
  const questions = [];

  // Step 2 — API key
  questions.push({
    type: "password",
    name: "apiKey",
    message: `API Key para ${provider.name}:`,
    default: current.apiKey ? `${current.apiKey.slice(0, 8)}...` : "",
    validate: (v) => (v && v.length > 4) || "Informe uma chave válida",
  });

  // Step 3 — Provider-specific fields
  if (providerKey === "azure-openai") {
    questions.push(
      {
        type: "input",
        name: "endpoint",
        message: "Endpoint Azure (ex: https://SEU-RESOURCE.openai.azure.com):",
        default: current.endpoint || "",
        validate: (v) => v.startsWith("https://") || "Informe uma URL válida",
      },
      {
        type: "input",
        name: "deployment",
        message: "Nome do Deployment (ex: gpt-4o):",
        default: current.deployment || "",
      },
      {
        type: "input",
        name: "apiVersion",
        message: "API Version:",
        default: current.apiVersion || "2024-05-01-preview",
      },
    );
  } else if (providerKey === "openai-compatible") {
    questions.push(
      {
        type: "input",
        name: "endpoint",
        message:
          "Endpoint base (ex: https://api.groq.com/openai/v1 ou http://localhost:11434/v1):",
        default: current.endpoint || "",
      },
      {
        type: "input",
        name: "model",
        message: "Nome do modelo (ex: llama3-70b-8192, mistral-medium):",
        default: current.model || "",
      },
    );
  } else if (provider.models.length > 0) {
    const modelChoices = [
      ...provider.models,
      { name: chalk.dim("Digitar outro..."), value: "__custom__" },
    ];
    questions.push({
      type: "list",
      name: "model",
      message: `Modelo ${provider.name}:`,
      choices: modelChoices,
      default: current.model || provider.models[0],
    });
    questions.push({
      type: "input",
      name: "customModel",
      message: "Nome do modelo customizado:",
      when: (ans) => ans.model === "__custom__",
    });
  }

  // Step 4 — Set as active
  questions.push({
    type: "confirm",
    name: "setActive",
    message: `Definir ${provider.name} como provedor ativo?`,
    default: true,
  });

  const answers = await inquirer.prompt(questions);

  // Persist — do NOT store the masked placeholder if user left it unchanged
  if (!config.providers[providerKey]) config.providers[providerKey] = {};
  const p = config.providers[providerKey];

  if (answers.apiKey && !answers.apiKey.endsWith("..."))
    p.apiKey = answers.apiKey;
  if (answers.endpoint) p.endpoint = answers.endpoint;
  if (answers.deployment) p.deployment = answers.deployment;
  if (answers.apiVersion) p.apiVersion = answers.apiVersion;
  if (answers.model && answers.model !== "__custom__") p.model = answers.model;
  if (answers.customModel) p.model = answers.customModel;

  if (answers.setActive) config.activeProvider = providerKey;

  saveConfig(config);

  ui.blank();
  ui.success(`Configuração salva!`);
  printKeyValue("Provedor ativo:", chalk.cyan(config.activeProvider));
  if (p.model) printKeyValue("Modelo:", p.model);
  if (p.endpoint) printKeyValue("Endpoint:", p.endpoint);
  printSeparator();
}

// ── Show helper ───────────────────────────────────────────────────────────────

function showCurrentConfig() {
  const config = loadConfig();

  ui.section("Configuração de IA Atual");
  printKeyValue("Provedor ativo:", chalk.cyan(config.activeProvider));
  printKeyValue("Config file:", CONFIG_FILE_PATH);
  ui.blank();

  const configured = Object.entries(config.providers).filter(
    ([, v]) => v?.apiKey,
  );
  if (configured.length === 0) {
    ui.warn("Nenhum provedor configurado. Execute: ng-migrate config");
    return;
  }

  for (const [key, cfg] of configured) {
    const active = key === config.activeProvider;
    const label = active
      ? chalk.bold.green(`  ${PROVIDERS[key]?.name || key}  ← ativo`)
      : chalk.bold(`  ${PROVIDERS[key]?.name || key}`);
    console.log(label);
    const masked = cfg.apiKey.slice(0, 8) + "••••" + cfg.apiKey.slice(-4);
    printKeyValue("  API Key:", masked);
    if (cfg.model) printKeyValue("  Modelo:", cfg.model);
    if (cfg.endpoint) printKeyValue("  Endpoint:", cfg.endpoint);
    if (cfg.deployment) printKeyValue("  Deployment:", cfg.deployment);
    console.log();
  }

  console.log(
    chalk.dim("  Execute ng-migrate config para adicionar/alterar provedores."),
  );
  printSeparator();
}
