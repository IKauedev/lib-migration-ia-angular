/**
 * doctor.js
 * Comando `ng-migrate doctor` — verifica a saúde do ambiente para uso do CLI.
 * Checa: versão Node, Angular CLI, git, configuração de IA e validade de API key.
 */

import { execSync, spawnSync } from "child_process";
import chalk from "chalk";
import { loadConfig } from "../utils/config-manager.js";
import { ui } from "../utils/ui.js";

const MIN_NODE_MAJOR = 18;

/**
 * @typedef {Object} CheckResult
 * @property {string} name - Nome do check
 * @property {'ok'|'warn'|'fail'} status
 * @property {string} message - Mensagem descritiva
 * @property {string} [fix] - Sugestão de correção
 */

/**
 * Executa um comando e retorna a saída, ou null em caso de erro.
 * @param {string} cmd
 * @returns {string|null}
 */
function runCmd(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Checa a versão do Node.js.
 * @returns {CheckResult}
 */
function checkNode() {
  const raw = process.version; // "v22.0.0"
  const major = parseInt(raw.replace("v", "").split(".")[0], 10);

  if (major >= MIN_NODE_MAJOR) {
    return {
      name: "Node.js",
      status: "ok",
      message: `${raw} (mínimo: v${MIN_NODE_MAJOR})`,
    };
  }
  return {
    name: "Node.js",
    status: "fail",
    message: `${raw} — versão insuficiente`,
    fix: `Instale Node.js >= v${MIN_NODE_MAJOR}: https://nodejs.org`,
  };
}

/**
 * Checa se o Angular CLI está instalado.
 * @returns {CheckResult}
 */
function checkAngularCli() {
  const version =
    runCmd("ng version --skip-git 2>&1") ||
    runCmd("npx @angular/cli version --skip-git 2>&1");
  if (version) {
    const match = version.match(/Angular CLI:\s*([\d.]+)/);
    const v = match ? match[1] : "instalado";
    return { name: "Angular CLI", status: "ok", message: `v${v}` };
  }
  return {
    name: "Angular CLI",
    status: "warn",
    message: "não encontrado",
    fix: "npm install -g @angular/cli",
  };
}

/**
 * Checa se o git está disponível.
 * @returns {CheckResult}
 */
function checkGit() {
  const version = runCmd("git --version");
  if (version) {
    return {
      name: "git",
      status: "ok",
      message: version.replace("git version ", ""),
    };
  }
  return {
    name: "git",
    status: "warn",
    message: "não encontrado — algumas funções podem não funcionar",
    fix: "https://git-scm.com/downloads",
  };
}

/**
 * Checa a configuração do provedor de IA.
 * @returns {CheckResult}
 */
function checkAiConfig() {
  let config;
  try {
    config = loadConfig();
  } catch {
    return {
      name: "Configuração IA",
      status: "fail",
      message: "arquivo de configuração não encontrado",
      fix: "Execute: ng-migrate config",
    };
  }

  if (!config || !config.provider) {
    return {
      name: "Configuração IA",
      status: "fail",
      message: "provedor não configurado",
      fix: "Execute: ng-migrate config",
    };
  }

  // Verifica se há chave de API (se necessário)
  const provider = config.provider;
  const providers = config.providers || {};
  const providerConfig = providers[provider] || {};
  const apiKey = providerConfig.apiKey || "";

  if (provider !== "ollama" && !apiKey) {
    return {
      name: "Configuração IA",
      status: "warn",
      message: `${provider} configurado mas sem API key`,
      fix: "Execute: ng-migrate config (ou ng-migrate env)",
    };
  }

  return {
    name: "Configuração IA",
    status: "ok",
    message: `${provider} / ${config.model || "sem modelo definido"}`,
  };
}

/**
 * Checa se a API key é válida fazendo um ping simples (opcional).
 * @param {boolean} verbose - Faz chamada real de teste
 * @returns {Promise<CheckResult>}
 */
async function checkApiKeyPing(verbose) {
  if (!verbose) {
    return {
      name: "API Key (ping)",
      status: "ok",
      message: "pulado (use --ping para testar)",
    };
  }

  let config;
  try {
    config = loadConfig();
  } catch {
    return {
      name: "API Key (ping)",
      status: "fail",
      message: "sem configuração",
    };
  }

  const provider = config.provider;
  const providers = config.providers || {};
  const providerConfig = providers[provider] || {};
  const apiKey = providerConfig.apiKey || "";

  if (!apiKey || provider === "ollama") {
    return {
      name: "API Key (ping)",
      status: "ok",
      message: "N/A (modelo local)",
    };
  }

  try {
    if (provider === "anthropic") {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const client = new Anthropic({ apiKey });
      await client.messages.create({
        model: config.model || "claude-3-5-haiku-20241022",
        max_tokens: 1,
        messages: [{ role: "user", content: "1" }],
      });
      return {
        name: "API Key (ping)",
        status: "ok",
        message: "Anthropic respondeu OK",
      };
    }

    if (provider === "openai" || provider === "azure") {
      const { default: OpenAI } = await import("openai");
      const opts = { apiKey };
      if (provider === "azure") {
        opts.baseURL = `${providerConfig.endpoint || ""}/openai/deployments/${providerConfig.deployment || ""}`;
        opts.defaultQuery = {
          "api-version": providerConfig.apiVersion || "2024-02-01",
        };
        opts.defaultHeaders = { "api-key": apiKey };
      }
      const client = new OpenAI(opts);
      await client.chat.completions.create({
        model: config.model || "gpt-4o-mini",
        max_tokens: 1,
        messages: [{ role: "user", content: "1" }],
      });
      return {
        name: "API Key (ping)",
        status: "ok",
        message: `${provider} respondeu OK`,
      };
    }

    return {
      name: "API Key (ping)",
      status: "ok",
      message: "ping não suportado para este provedor",
    };
  } catch (err) {
    return {
      name: "API Key (ping)",
      status: "fail",
      message: `Falha: ${err.message?.slice(0, 80)}`,
      fix: "Verifique a API key em: ng-migrate config",
    };
  }
}

/**
 * Imprime um resultado de check formatado.
 * @param {CheckResult} result
 */
function printResult(result) {
  const icons = {
    ok: chalk.green("✓"),
    warn: chalk.yellow("⚠"),
    fail: chalk.red("✗"),
  };
  const colors = { ok: chalk.green, warn: chalk.yellow, fail: chalk.red };
  const icon = icons[result.status] || "?";
  const color = colors[result.status] || chalk.white;

  console.log(
    `  ${icon}  ${chalk.bold(result.name.padEnd(20))} ${color(result.message)}`,
  );
  if (result.fix) {
    console.log(`        ${chalk.dim("→")} ${chalk.cyan(result.fix)}`);
  }
}

/**
 * Comando principal do doctor.
 * @param {object} opts - Opções do Commander
 * @param {boolean} [opts.ping] - Faz chamada real de ping para validar API key
 */
export async function doctorCommand(opts = {}) {
  ui.sectionHeader("ng-migrate doctor — verificação de ambiente");
  console.log();

  const checks = [
    checkNode(),
    checkAngularCli(),
    checkGit(),
    checkAiConfig(),
    await checkApiKeyPing(opts.ping || false),
  ];

  for (const c of checks) {
    printResult(c);
  }

  const failures = checks.filter((c) => c.status === "fail");
  const warnings = checks.filter((c) => c.status === "warn");
  const ok = checks.filter((c) => c.status === "ok");

  console.log();
  if (failures.length === 0 && warnings.length === 0) {
    console.log(chalk.green.bold("  Tudo OK! Ambiente pronto para migração."));
  } else {
    if (failures.length > 0) {
      console.log(
        chalk.red.bold(
          `  ${failures.length} problema(s) crítico(s) encontrado(s).`,
        ),
      );
    }
    if (warnings.length > 0) {
      console.log(
        chalk.yellow(
          `  ${warnings.length} aviso(s): verifique as sugestões acima.`,
        ),
      );
    }
  }

  console.log(
    chalk.dim(
      `\n  Resumo: ${ok.length} ok, ${warnings.length} avisos, ${failures.length} falhas\n`,
    ),
  );

  // Sai com código de erro se houver falhas críticas
  if (failures.length > 0) {
    process.exitCode = 1;
  }
}
