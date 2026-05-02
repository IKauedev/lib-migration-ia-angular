/**
 * plugin-loader.js
 * Carrega e aplica plugins de customização definidos em `ng-migrate.config.js`.
 *
 * Schema esperado do arquivo de plugin:
 * ```js
 * export default {
 *   rules: [
 *     { pattern: /myPattern/g, replaceWith: 'replacement', description: 'desc' },
 *   ],
 *   postProcess: async (code, filename) => code, // função opcional de pós-processamento
 *   skipFiles: ['src/legacy/**'],
 *   promptAdditions: 'Utilize sempre injeção via inject() em vez de constructor.',
 * };
 * ```
 */

import path from "path";
import { existsSync } from "fs";
import { pathToFileURL } from "url";
import { dbg } from "./debug.js";

/**
 * @typedef {Object} PluginRule
 * @property {RegExp|string} pattern - Padrão de busca
 * @property {string|Function} replaceWith - Substituto
 * @property {string} [description] - Descrição da regra
 */

/**
 * @typedef {Object} NgMigratePlugin
 * @property {PluginRule[]} [rules] - Regras de substituição adicionais
 * @property {Function} [postProcess] - async (code: string, filename: string) => string
 * @property {string[]} [skipFiles] - Glob patterns de arquivos a pular
 * @property {string} [promptAdditions] - Texto extra para os prompts da IA
 */

const CONFIG_FILENAMES = [
  "ng-migrate.config.js",
  "ng-migrate.config.mjs",
  ".ng-migrate.config.js",
  ".ng-migrate.config.mjs",
];

/**
 * Carrega o plugin de customização do diretório do projeto.
 *
 * @param {string} projectDir - Raiz do projeto AngularJS sendo migrado
 * @returns {Promise<NgMigratePlugin|null>} Plugin carregado ou null se não encontrado
 */
export async function loadPlugin(projectDir) {
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.resolve(projectDir, filename);
    if (!existsSync(configPath)) continue;

    try {
      const fileUrl = pathToFileURL(configPath).href;
      const module = await import(fileUrl);
      const plugin = module.default || module;

      dbg(`[plugin-loader] Plugin carregado: ${configPath}`);
      _validatePlugin(plugin);
      return plugin;
    } catch (err) {
      console.warn(
        `[ng-migrate] Aviso: falha ao carregar plugin "${filename}": ${err.message}`,
      );
      return null;
    }
  }

  dbg(
    "[plugin-loader] Nenhum arquivo ng-migrate.config.js encontrado no projeto.",
  );
  return null;
}

/**
 * Valida a estrutura básica do plugin e emite avisos para campos inválidos.
 * @param {NgMigratePlugin} plugin
 */
function _validatePlugin(plugin) {
  if (!plugin || typeof plugin !== "object") {
    throw new Error("O plugin deve exportar um objeto (default export).");
  }
  if (plugin.rules !== undefined && !Array.isArray(plugin.rules)) {
    throw new Error("plugin.rules deve ser um array.");
  }
  if (
    plugin.postProcess !== undefined &&
    typeof plugin.postProcess !== "function"
  ) {
    throw new Error(
      "plugin.postProcess deve ser uma função async (code, filename) => string.",
    );
  }
  if (plugin.skipFiles !== undefined && !Array.isArray(plugin.skipFiles)) {
    throw new Error(
      "plugin.skipFiles deve ser um array de strings (glob patterns).",
    );
  }
  if (
    plugin.promptAdditions !== undefined &&
    typeof plugin.promptAdditions !== "string"
  ) {
    throw new Error("plugin.promptAdditions deve ser uma string.");
  }
}

/**
 * Aplica as regras do plugin a um trecho de código.
 *
 * @param {string} code - Código TypeScript migrado
 * @param {NgMigratePlugin|null} plugin
 * @param {string} [filename]
 * @returns {string} Código com regras do plugin aplicadas
 */
export function applyPluginRules(code, plugin, filename = "unknown") {
  if (!plugin || !Array.isArray(plugin.rules) || plugin.rules.length === 0) {
    return code;
  }

  let result = code;
  for (const rule of plugin.rules) {
    if (!rule.pattern) continue;
    const pattern =
      typeof rule.pattern === "string"
        ? new RegExp(rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
        : rule.pattern;

    const before = result;
    if (typeof rule.replaceWith === "function") {
      result = result.replace(pattern, rule.replaceWith);
    } else {
      result = result.replace(pattern, rule.replaceWith ?? "");
    }

    if (result !== before) {
      dbg(
        `[plugin-loader] ${filename}: regra customizada aplicada — ${rule.description || rule.pattern}`,
      );
    }
  }

  return result;
}

/**
 * Executa a função postProcess do plugin (se existir).
 *
 * @param {string} code
 * @param {NgMigratePlugin|null} plugin
 * @param {string} [filename]
 * @returns {Promise<string>}
 */
export async function runPluginPostProcess(code, plugin, filename = "unknown") {
  if (!plugin || typeof plugin.postProcess !== "function") {
    return code;
  }

  try {
    const result = await plugin.postProcess(code, filename);
    if (typeof result === "string") {
      dbg(`[plugin-loader] ${filename}: postProcess do plugin executado.`);
      return result;
    }
    console.warn(
      "[ng-migrate] plugin.postProcess deve retornar uma string — resultado ignorado.",
    );
    return code;
  } catch (err) {
    console.warn(
      `[ng-migrate] Erro em plugin.postProcess para "${filename}": ${err.message}`,
    );
    return code;
  }
}

/**
 * Verifica se um arquivo deve ser pulado conforme os padrões do plugin.
 * Suporte básico a padrões glob simples (usa path.matchesGlob do Node 22 ou fallback manual).
 *
 * @param {string} filePath - Caminho relativo do arquivo
 * @param {NgMigratePlugin|null} plugin
 * @returns {boolean}
 */
export function shouldSkipFile(filePath, plugin) {
  if (
    !plugin ||
    !Array.isArray(plugin.skipFiles) ||
    plugin.skipFiles.length === 0
  ) {
    return false;
  }

  const normalized = filePath.replace(/\\/g, "/");

  for (const pattern of plugin.skipFiles) {
    if (_matchGlob(normalized, pattern)) {
      dbg(
        `[plugin-loader] Arquivo pulado por regra do plugin: ${filePath} (padrão: ${pattern})`,
      );
      return true;
    }
  }

  return false;
}

/**
 * Correspondência glob simples (suporte a * e **).
 * @param {string} str
 * @param {string} pattern
 * @returns {boolean}
 */
function _matchGlob(str, pattern) {
  // Escapa caracteres especiais de regex exceto * e ?
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "(.+)")
    .replace(/\*/g, "([^/]+)")
    .replace(/\?/g, "[^/]");

  try {
    return new RegExp(`^${regexStr}$`).test(str);
  } catch {
    return str.includes(pattern);
  }
}

/**
 * Extrai o texto extra para o prompt de IA do plugin.
 * @param {NgMigratePlugin|null} plugin
 * @returns {string}
 */
export function getPluginPromptAdditions(plugin) {
  return plugin?.promptAdditions ?? "";
}
