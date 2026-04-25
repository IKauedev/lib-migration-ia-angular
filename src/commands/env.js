import chalk from "chalk";
import {
  readEnvFile,
  writeEnvFile,
  ENV_FILE_PATH,
} from "../utils/env-loader.js";
import { ui, printSeparator, printKeyValue } from "../utils/ui.js";

// Known variables with descriptions
const KNOWN_VARS = {
  ANTHROPIC_API_KEY: {
    desc: "Chave da API Anthropic (Claude)",
    sensitive: true,
  },
  OPENAI_API_KEY: { desc: "Chave da API OpenAI (GPT)", sensitive: true },
  AZURE_OPENAI_KEY: { desc: "Chave da API Azure OpenAI", sensitive: true },
  AZURE_OPENAI_ENDPOINT: {
    desc: "Endpoint Azure OpenAI (https://...)",
    sensitive: false,
  },
  AZURE_OPENAI_DEPLOYMENT: {
    desc: "Nome do deployment Azure OpenAI",
    sensitive: false,
  },
  AZURE_OPENAI_API_VERSION: {
    desc: "Versão da API Azure (ex: 2024-05-01-preview)",
    sensitive: false,
  },
  GOOGLE_API_KEY: { desc: "Chave da API Google Gemini", sensitive: true },
  GITHUB_TOKEN: { desc: "Token GitHub (para migrate-repo)", sensitive: true },
  GITLAB_TOKEN: { desc: "Token GitLab (para migrate-repo)", sensitive: true },
  GITLAB_URL: {
    desc: "URL base do GitLab (padrão: https://gitlab.com)",
    sensitive: false,
  },
};

export async function envCommand(subCmd, args, opts) {
  // ── Interactive wizard if no sub-command ───────────────────────────────────
  if (!subCmd) {
    await interactiveSetup();
    return;
  }

  const cmd = subCmd.toLowerCase();

  if (cmd === "list" || cmd === "listar") {
    listVars();
    return;
  }

  if (cmd === "set" || cmd === "definir") {
    const [key, ...rest] = args;
    const value = rest.join(" ");
    if (!key || !value) {
      ui.error("Uso: ng-migrate env set <VARIAVEL> <valor>");
      ui.info("Exemplo: ng-migrate env set OPENAI_API_KEY sk-...");
      process.exit(1);
    }
    setVar(key.toUpperCase(), value);
    return;
  }

  if (cmd === "remove" || cmd === "remover" || cmd === "unset") {
    const [key] = args;
    if (!key) {
      ui.error("Uso: ng-migrate env remove <VARIAVEL>");
      process.exit(1);
    }
    removeVar(key.toUpperCase());
    return;
  }

  if (cmd === "clear" || cmd === "limpar") {
    await clearAll();
    return;
  }

  ui.error(`Sub-comando desconhecido: ${subCmd}`);
  ui.info("Comandos disponíveis: list | set | remove | clear");
  process.exit(1);
}

// ── Interactive setup wizard ──────────────────────────────────────────────────

async function interactiveSetup() {
  const { default: inquirer } = await import("inquirer");

  ui.section("Configuração de Variáveis de Ambiente");
  console.log(chalk.dim(`  Arquivo: ${ENV_FILE_PATH}\n`));
  console.log(
    chalk.dim(
      "  As variáveis aqui definidas são carregadas automaticamente pelo ng-migrate.",
    ),
  );
  console.log(
    chalk.dim(
      "  Variáveis já definidas no sistema operacional têm prioridade.\n",
    ),
  );

  const current = readEnvFile();

  const choices = [
    ...Object.entries(KNOWN_VARS).map(([key, meta]) => ({
      name: `${key.padEnd(28)} ${chalk.dim(meta.desc)}${current[key] ? chalk.green("  ✔ definida") : ""}`,
      value: key,
    })),
    new inquirer.Separator(),
    { name: chalk.dim("Variável personalizada..."), value: "__custom__" },
    { name: chalk.yellow("Remover variável(eis)..."), value: "__remove__" },
    { name: chalk.dim("Listar variáveis salvas"), value: "__list__" },
    { name: chalk.dim("Sair"), value: "__exit__" },
  ];

  while (true) {
    const { selected } = await inquirer.prompt([
      {
        type: "list",
        name: "selected",
        message: "Selecione a variável para definir:",
        choices,
        pageSize: 15,
      },
    ]);

    if (selected === "__exit__") break;

    if (selected === "__list__") {
      listVars();
      continue;
    }

    if (selected === "__remove__") {
      await removeInteractive(inquirer);
      continue;
    }

    let varName = selected;
    if (selected === "__custom__") {
      const { name } = await inquirer.prompt([
        {
          type: "input",
          name: "name",
          message: "Nome da variável (ex: MY_CUSTOM_API_KEY):",
          validate: (v) =>
            /^[A-Z0-9_]+$/.test(v.toUpperCase()) ||
            "Use apenas letras, números e _",
          filter: (v) => v.toUpperCase(),
        },
      ]);
      varName = name;
    }

    const isSensitive = KNOWN_VARS[varName]?.sensitive !== false;
    const existing = current[varName];

    const { value } = await inquirer.prompt([
      {
        type: isSensitive ? "password" : "input",
        name: "value",
        message: `Valor para ${chalk.cyan(varName)}:`,
        default: existing || "",
        validate: (v) => (v && v.trim().length > 0) || "Informe um valor",
      },
    ]);

    if (value && !(isSensitive && value.endsWith("..."))) {
      setVar(varName, value.trim(), { silent: false });
    }
  }

  ui.blank();
  ui.success("Configuração salva!");
  printSeparator();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setVar(key, value, { silent = false } = {}) {
  const vars = readEnvFile();
  vars[key] = value;
  writeEnvFile(vars);
  if (!silent) {
    const meta = KNOWN_VARS[key];
    const display = meta?.sensitive
      ? value.slice(0, 8) + "••••" + value.slice(-4)
      : value;
    ui.success(`${chalk.cyan(key)} definida: ${chalk.dim(display)}`);
    ui.info(`Arquivo: ${chalk.dim(ENV_FILE_PATH)}`);
  }
}

function removeVar(key) {
  const vars = readEnvFile();
  if (!(key in vars)) {
    ui.warn(
      `Variável ${chalk.cyan(key)} não encontrada no arquivo de ambiente.`,
    );
    return;
  }
  delete vars[key];
  writeEnvFile(vars);
  ui.success(`${chalk.cyan(key)} removida.`);
}

async function removeInteractive(inquirer) {
  const vars = readEnvFile();
  const keys = Object.keys(vars);

  if (keys.length === 0) {
    ui.warn("Nenhuma variável definida para remover.");
    return;
  }

  const { selected } = await inquirer.prompt([
    {
      type: "checkbox",
      name: "selected",
      message:
        "Selecione as variáveis para remover (Espaço para marcar, Enter para confirmar):",
      choices: keys.map((key) => {
        const meta = KNOWN_VARS[key];
        const val = vars[key];
        const display =
          meta?.sensitive !== false
            ? val.slice(0, 8) + "••••" + val.slice(-4)
            : val;
        return {
          name: `${chalk.cyan(key.padEnd(30))} ${chalk.dim(display)}`,
          value: key,
        };
      }),
      validate: (v) =>
        v.length > 0 ||
        "Selecione ao menos uma variável ou pressione Ctrl+C para cancelar",
    },
  ]);

  if (selected.length === 0) return;

  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: `Remover ${selected.length === 1 ? `a variável ${chalk.cyan(selected[0])}` : `${selected.length} variáveis`}?`,
      default: false,
    },
  ]);

  if (!confirm) {
    ui.warn("Operação cancelada.");
    return;
  }

  const updatedVars = readEnvFile();
  for (const key of selected) {
    delete updatedVars[key];
  }
  writeEnvFile(updatedVars);

  for (const key of selected) {
    ui.success(`${chalk.cyan(key)} removida.`);
  }
}

async function clearAll() {
  const { default: inquirer } = await import("inquirer");
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Remover TODAS as variáveis de ambiente salvas?",
      default: false,
    },
  ]);
  if (confirm) {
    writeEnvFile({});
    ui.success("Todas as variáveis removidas.");
  }
}

function listVars() {
  const vars = readEnvFile();
  const keys = Object.keys(vars);

  ui.section("Variáveis de Ambiente Salvas");
  console.log(chalk.dim(`  Arquivo: ${ENV_FILE_PATH}\n`));

  if (keys.length === 0) {
    ui.warn("Nenhuma variável definida. Execute: ng-migrate env");
    return;
  }

  for (const key of keys) {
    const meta = KNOWN_VARS[key];
    const val = vars[key];
    const display =
      meta?.sensitive !== false
        ? val.slice(0, 8) + "••••" + val.slice(-4)
        : val;
    const desc = meta ? chalk.dim(`  ${meta.desc}`) : "";
    printKeyValue(`  ${key}:`, display + desc);
  }

  ui.blank();
  console.log(
    chalk.dim(
      "  Os valores definidos no sistema operacional têm prioridade sobre este arquivo.",
    ),
  );
  printSeparator();
}
