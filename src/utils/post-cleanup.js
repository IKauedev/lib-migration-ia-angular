/**
 * post-cleanup.js
 * Aplica correções automáticas de padrões AngularJS residuais no código migrado.
 * Roda APÓS a IA converter, sem precisar de nova chamada à IA.
 */

import { dbg } from "./debug.js";

/**
 * @typedef {Object} CleanupRule
 * @property {string} name - Nome da regra
 * @property {RegExp} pattern - Regex de detecção
 * @property {string|Function} replacement - Substituto (string ou função)
 * @property {string} description - Descrição da mudança
 */

/** @type {CleanupRule[]} */
const CLEANUP_RULES = [
  // ── angular.* API replacements ──────────────────────────────────────────
  {
    name: "angular.copy",
    pattern: /angular\.copy\s*\(([^,)]+)\)/g,
    replacement: "structuredClone($1)",
    description: "angular.copy(x) → structuredClone(x)",
  },
  {
    name: "angular.copy-target",
    pattern: /angular\.copy\s*\(([^,)]+),\s*([^)]+)\)/g,
    replacement: "Object.assign($2, structuredClone($1))",
    description:
      "angular.copy(src, dst) → Object.assign(dst, structuredClone(src))",
  },
  {
    name: "angular.extend",
    pattern: /angular\.extend\s*\(([^,)]+),\s*([^)]+)\)/g,
    replacement: "Object.assign($1, $2)",
    description: "angular.extend(a, b) → Object.assign(a, b)",
  },
  {
    name: "angular.merge",
    pattern: /angular\.merge\s*\(/g,
    replacement: "structuredClone(",
    description: "angular.merge() → structuredClone()",
  },
  {
    name: "angular.forEach",
    pattern: /angular\.forEach\s*\(([^,)]+),\s*/g,
    replacement: "($1).forEach(",
    description: "angular.forEach(arr, fn) → arr.forEach(fn)",
  },
  {
    name: "angular.isArray",
    pattern: /angular\.isArray\s*\(/g,
    replacement: "Array.isArray(",
    description: "angular.isArray() → Array.isArray()",
  },
  {
    name: "angular.isString",
    pattern: /angular\.isString\s*\(([^)]+)\)/g,
    replacement: "(typeof $1 === 'string')",
    description: "angular.isString(x) → typeof x === 'string'",
  },
  {
    name: "angular.isNumber",
    pattern: /angular\.isNumber\s*\(([^)]+)\)/g,
    replacement: "(typeof $1 === 'number')",
    description: "angular.isNumber(x) → typeof x === 'number'",
  },
  {
    name: "angular.isFunction",
    pattern: /angular\.isFunction\s*\(([^)]+)\)/g,
    replacement: "(typeof $1 === 'function')",
    description: "angular.isFunction(x) → typeof x === 'function'",
  },
  {
    name: "angular.isDefined",
    pattern: /angular\.isDefined\s*\(([^)]+)\)/g,
    replacement: "($1 !== undefined)",
    description: "angular.isDefined(x) → x !== undefined",
  },
  {
    name: "angular.isUndefined",
    pattern: /angular\.isUndefined\s*\(([^)]+)\)/g,
    replacement: "($1 === undefined)",
    description: "angular.isUndefined(x) → x === undefined",
  },
  {
    name: "angular.isObject",
    pattern: /angular\.isObject\s*\(([^)]+)\)/g,
    replacement: "($1 !== null && typeof $1 === 'object')",
    description: "angular.isObject(x) → x !== null && typeof x === 'object'",
  },
  {
    name: "angular.noop",
    pattern: /angular\.noop\b/g,
    replacement: "(() => {})",
    description: "angular.noop → (() => {})",
  },
  {
    name: "angular.identity",
    pattern: /angular\.identity\b/g,
    replacement: "((x: unknown) => x)",
    description: "angular.identity → ((x) => x)",
  },
  {
    name: "angular.toJson",
    pattern: /angular\.toJson\s*\(([^)]+)\)/g,
    replacement: "JSON.stringify($1)",
    description: "angular.toJson(x) → JSON.stringify(x)",
  },
  {
    name: "angular.fromJson",
    pattern: /angular\.fromJson\s*\(([^)]+)\)/g,
    replacement: "JSON.parse($1)",
    description: "angular.fromJson(x) → JSON.parse(x)",
  },
  {
    name: "angular.uppercase",
    pattern: /angular\.uppercase\s*\(([^)]+)\)/g,
    replacement: "($1).toUpperCase()",
    description: "angular.uppercase(x) → x.toUpperCase()",
  },
  {
    name: "angular.lowercase",
    pattern: /angular\.lowercase\s*\(([^)]+)\)/g,
    replacement: "($1).toLowerCase()",
    description: "angular.lowercase(x) → x.toLowerCase()",
  },
  {
    name: "angular.bind",
    pattern: /angular\.bind\s*\(([^,)]+),\s*([^)]+)\)/g,
    replacement: "$2.bind($1)",
    description: "angular.bind(ctx, fn) → fn.bind(ctx)",
  },

  // ── $timeout / $interval → modern equivalents ────────────────────────────
  {
    name: "$timeout-simple",
    pattern: /\$timeout\s*\(/g,
    replacement: "setTimeout(",
    description: "$timeout(...) → setTimeout(...)",
  },
  {
    name: "$interval-simple",
    pattern: /\$interval\s*\(/g,
    replacement: "setInterval(",
    description: "$interval(...) → setInterval(...)",
  },

  // ── $log → console ────────────────────────────────────────────────────────
  {
    name: "$log.log",
    pattern: /\$log\.log\s*\(/g,
    replacement: "console.log(",
    description: "$log.log() → console.log()",
  },
  {
    name: "$log.info",
    pattern: /\$log\.info\s*\(/g,
    replacement: "console.info(",
    description: "$log.info() → console.info()",
  },
  {
    name: "$log.warn",
    pattern: /\$log\.warn\s*\(/g,
    replacement: "console.warn(",
    description: "$log.warn() → console.warn()",
  },
  {
    name: "$log.error",
    pattern: /\$log\.error\s*\(/g,
    replacement: "console.error(",
    description: "$log.error() → console.error()",
  },
  {
    name: "$log.debug",
    pattern: /\$log\.debug\s*\(/g,
    replacement: "console.debug(",
    description: "$log.debug() → console.debug()",
  },

  // ── $window / $document ───────────────────────────────────────────────────
  {
    name: "$window",
    pattern: /\$window\b/g,
    replacement: "window",
    description: "$window → window",
  },
  {
    name: "$document-0",
    pattern: /\$document\[0\]/g,
    replacement: "document",
    description: "$document[0] → document",
  },
  {
    name: "$document",
    pattern: /\$document\b/g,
    replacement: "document",
    description: "$document → document",
  },

  // ── $q.resolve / $q.reject ────────────────────────────────────────────────
  {
    name: "$q.resolve",
    pattern: /\$q\.resolve\s*\(/g,
    replacement: "Promise.resolve(",
    description: "$q.resolve() → Promise.resolve()",
  },
  {
    name: "$q.reject",
    pattern: /\$q\.reject\s*\(/g,
    replacement: "Promise.reject(",
    description: "$q.reject() → Promise.reject()",
  },
  {
    name: "$q.all",
    pattern: /\$q\.all\s*\(/g,
    replacement: "Promise.all(",
    description: "$q.all() → Promise.all()",
  },

  // ── console.log from $log injection (remove injected $log) ───────────────
  // Remove $log from constructor injections (covered by lib-mapper separately)
];

/**
 * @typedef {Object} CleanupResult
 * @property {string} code - Código limpo
 * @property {Array<{rule: string, count: number, description: string}>} applied - Regras aplicadas
 * @property {number} totalReplacements - Total de substituições feitas
 */

/**
 * Aplica todas as regras de limpeza no código migrado.
 *
 * @param {string} code - Código TypeScript migrado
 * @param {string} [filename] - Nome do arquivo (para debug)
 * @param {CleanupRule[]} [extraRules] - Regras adicionais (de plugins)
 * @returns {CleanupResult}
 */
export function applyPostCleanup(code, filename = "unknown", extraRules = []) {
  let result = code;
  const applied = [];

  const allRules = [...CLEANUP_RULES, ...extraRules];

  for (const rule of allRules) {
    let count = 0;
    const before = result;

    if (typeof rule.replacement === "function") {
      result = result.replace(rule.pattern, (...args) => {
        count++;
        return rule.replacement(...args);
      });
    } else {
      result = result.replace(rule.pattern, () => {
        count++;
        return rule.replacement;
      });
    }

    if (count > 0) {
      applied.push({ rule: rule.name, count, description: rule.description });
      dbg(
        `[post-cleanup] ${filename}: ${rule.name} (${count}×) — ${rule.description}`,
      );
    }
  }

  const totalReplacements = applied.reduce((s, r) => s + r.count, 0);
  if (totalReplacements > 0) {
    dbg(
      `[post-cleanup] ${filename}: ${totalReplacements} substituição(ões) em ${applied.length} regra(s)`,
    );
  }

  return { code: result, applied, totalReplacements };
}

/**
 * Verifica se o código tem padrões AngularJS residuais que a limpeza não cobre.
 * Serve como aviso para o relatório.
 *
 * @param {string} code
 * @returns {string[]} Lista de padrões residuais encontrados
 */
export function detectUncleaned(code) {
  const residuals = [
    { pattern: /angular\.module\s*\(/, label: "angular.module()" },
    { pattern: /\$scope\b/, label: "$scope" },
    { pattern: /\$rootScope\b/, label: "$rootScope" },
    { pattern: /\$http\b/, label: "$http" },
    { pattern: /\$routeProvider\b/, label: "$routeProvider" },
    { pattern: /ng-controller\s*=/, label: "ng-controller" },
    { pattern: /ng-repeat\s*=/, label: "ng-repeat" },
    { pattern: /ng-if\s*=/, label: "ng-if" },
    { pattern: /\.controller\s*\(["']/, label: ".controller()" },
    { pattern: /\.service\s*\(["']/, label: ".service()" },
    { pattern: /\.factory\s*\(["']/, label: ".factory()" },
    { pattern: /\.filter\s*\(["']/, label: ".filter()" },
    { pattern: /\.directive\s*\(["']/, label: ".directive()" },
    { pattern: /\$compile\b/, label: "$compile" },
    { pattern: /\$sce\b/, label: "$sce" },
    { pattern: /\$broadcast\b/, label: "$broadcast" },
    { pattern: /\$emit\b/, label: "$emit" },
    { pattern: /\$on\b/, label: "$on" },
    { pattern: /angular\.element\b/, label: "angular.element()" },
  ];

  return residuals.filter((r) => r.pattern.test(code)).map((r) => r.label);
}

/**
 * Retorna as regras de limpeza disponíveis (para documentação/debug).
 * @returns {CleanupRule[]}
 */
export function getCleanupRules() {
  return CLEANUP_RULES;
}
