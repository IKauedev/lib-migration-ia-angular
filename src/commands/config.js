import chalk from "chalk";
import {
  loadConfig,
  saveConfig,
  PROVIDERS,
  TASK_LABELS,
  CONFIG_FILE_PATH,
} from "../utils/config-manager.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";

export async function configCommand(opts) {

  if (opts.show) {
    showCurrentConfig();
    return;
  }


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
      saveConfig({
        activeProvider: "anthropic",
        providers: {},
        taskModels: {},
      });
      ui.success("Configuração redefinida.");
    }
    return;
  }


  if (opts.taskModel) {
    await configureTaskModels();
    return;
  }

  ui.section("Configuração de Provedores de IA");
  console.log(chalk.dim(`  Configurações salvas em: ${CONFIG_FILE_PATH}\n`));

  const { default: inquirer } = await import("inquirer");
  const config = loadConfig();


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


  if (!provider.noKeyRequired) {
    questions.push({
      type: "password",
      name: "apiKey",
      message: `API Key para ${provider.name}:`,
      default: current.apiKey ? `${current.apiKey.slice(0, 8)}...` : "",
      validate: (v) => (v && v.length > 4) || "Informe uma chave válida",
    });
  }


  if (providerKey === "openrouter" && !current.apiKey) {
    console.log();
    console.log(
      chalk.dim("  Obtenha sua API key em: ") +
        chalk.cyan("https://openrouter.ai/keys"),
    );
    console.log();
  }


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
        message: "Endpoint base (ex: https://api.groq.com/openai/v1):",
        default: current.endpoint || "",
      },
      {
        type: "input",
        name: "model",
        message: "Nome do modelo (ex: llama3-70b-8192, mistral-medium):",
        default: current.model || "",
      },
    );
  } else if (providerKey === "ollama") {
    console.log();
    console.log(
      chalk.dim("  Ollama roda localmente — sem API key necessária."),
    );
    console.log(chalk.dim("  Instale em: ") + chalk.cyan("https://ollama.com"));
    console.log(
      chalk.dim("  Modelos disponíveis: ") +
        chalk.cyan("https://ollama.com/library"),
    );
    console.log();
    questions.push(
      {
        type: "input",
        name: "endpoint",
        message: "Endpoint Ollama (padrão: http://localhost:11434):",
        default: current.endpoint || "http://localhost:11434",
      },
      {
        type: "input",
        name: "model",
        message: "Modelo (ex: llama3, mistral, codellama, phi3):",
        default: current.model || "llama3",
        validate: (v) => (v && v.length > 0) || "Informe o nome do modelo",
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


  questions.push({
    type: "confirm",
    name: "setActive",
    message: `Definir ${provider.name} como provedor ativo?`,
    default: true,
  });

  const answers = await inquirer.prompt(questions);


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



function showCurrentConfig() {
  const config = loadConfig();

  ui.section("Configuração de IA Atual");
  printKeyValue("Provedor ativo:", chalk.cyan(config.activeProvider));
  printKeyValue("Config file:", CONFIG_FILE_PATH);
  ui.blank();

  const configured = Object.entries(config.providers).filter(
    ([key, v]) =>
      v?.apiKey || (PROVIDERS[key]?.noKeyRequired && (v?.endpoint || v?.model)),
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


  const taskModels = config.taskModels || {};
  if (Object.keys(taskModels).length > 0) {
    ui.blank();
    console.log(chalk.bold("  Modelos por tarefa:"));
    for (const [task, cfg] of Object.entries(taskModels)) {
      const label = TASK_LABELS[task] || task;
      console.log(
        chalk.cyan(`    ${task}`) +
          chalk.dim(` (${label}): `) +
          chalk.white(`${cfg.provider} / ${cfg.model || "modelo padrão"}`),
      );
    }
    ui.blank();
    console.log(
      chalk.dim("  Execute ng-migrate config --task-model para configurar."),
    );
  } else {
    ui.blank();
    console.log(
      chalk.dim(
        "  Todas as tarefas usam o provedor ativo. Execute ng-migrate config --task-model para configurar modelos por tarefa.",
      ),
    );
  }

  printSeparator();
}



async function configureTaskModels() {
  const { default: inquirer } = await import("inquirer");
  const config = loadConfig();
  const taskModels = config.taskModels || {};

  ui.section("Configuração de Modelos por Tarefa");
  console.log(
    chalk.dim(
      "  Configure provedores e modelos diferentes para cada operação de IA.\n" +
        "  Deixe em branco para usar o provedor ativo como padrão.\n",
    ),
  );

  const providerChoices = [
    { name: chalk.dim("(usar provedor ativo)"), value: "" },
    ...Object.entries(PROVIDERS).map(([key, val]) => ({
      name: val.name,
      value: key,
    })),
  ];

  for (const [taskKey, taskLabel] of Object.entries(TASK_LABELS)) {
    const current = taskModels[taskKey] || {};
    console.log(chalk.bold(`\n  ${taskLabel}`));

    const { provider } = await inquirer.prompt([
      {
        type: "list",
        name: "provider",
        message: "  Provedor:",
        choices: providerChoices,
        default: current.provider || "",
      },
    ]);

    if (!provider) {

      delete taskModels[taskKey];
      console.log(chalk.dim("    → usando provedor ativo\n"));
      continue;
    }

    const providerCfg = config.providers[provider] || {};
    const knownModels = PROVIDERS[provider]?.models || [];

    let model = current.model || providerCfg.model || "";

    if (knownModels.length > 0) {
      const modelChoices = [
        ...knownModels,
        { name: chalk.dim("Digitar outro..."), value: "__custom__" },
      ];
      const { chosenModel } = await inquirer.prompt([
        {
          type: "list",
          name: "chosenModel",
          message: "  Modelo:",
          choices: modelChoices,
          default: model || knownModels[0],
        },
      ]);
      if (chosenModel === "__custom__") {
        const { customModel } = await inquirer.prompt([
          {
            type: "input",
            name: "customModel",
            message: "  Nome do modelo:",
            default: model,
          },
        ]);
        model = customModel;
      } else {
        model = chosenModel;
      }
    } else {
      const { typedModel } = await inquirer.prompt([
        {
          type: "input",
          name: "typedModel",
          message: "  Nome do modelo:",
          default: model,
        },
      ]);
      model = typedModel;
    }

    taskModels[taskKey] = { provider, model };
    console.log(
      chalk.green("    ✔ ") + chalk.dim(`${provider} / ${model || "padrão"}\n`),
    );
  }

  config.taskModels = taskModels;
  saveConfig(config);

  ui.blank();
  ui.success("Configuração de modelos por tarefa salva!");
  printSeparator();
}
