/**
 * AngularJS code classifier.
 * Shared detection utilities used by migrate-repo and analyze commands.
 */

import path from "node:path";

// ── Glob-like filename matching ───────────────────────────────────────────────

/** File/path patterns to always skip when scanning for migration. */
const SKIP_PATTERNS = [
    /node_modules/,
    /\.min\.js$/,
    /dist\//,
    /coverage\//,
    /\.git\//,
    /\.angular\//,
    /e2e\//,
    /\.spec\.(js|ts)$/,
    /karma\.conf/,
    /protractor/,
    /\.d\.ts$/,
];

/**
 * Returns true if the given file path should be excluded from migration.
 * @param {string} filePath
 * @returns {boolean}
 */
export function shouldSkip(filePath) {
    const norm = filePath.replace(/\\/g, "/");
    return SKIP_PATTERNS.some((p) => p.test(norm));
}

/**
 * Returns true if the file path matches any of the given patterns.
 * Supports "*" as a wildcard for matching file extensions/names.
 * @param {string} filePath
 * @param {string|string[]|undefined} only
 * @returns {boolean}
 */
export function matchesOnly(filePath, only) {
    if (!only) return true;
    const patterns = Array.isArray(only) ?
        only :
        only.split(",").map((s) => s.trim());
    const base = path.basename(filePath);
    return patterns.some((pat) => {
        const escaped = pat.replace(/\./g, "\\.").replace(/\*/g, ".*");
        return new RegExp(escaped, "i").test(base);
    });
}

// ── AngularJS detection ───────────────────────────────────────────────────────

/** Patterns that strongly indicate AngularJS code (qualitative — used by analyze). */
const LOOKSLIKE_PATTERNS = [
    /angular\.module\s*\(/,
    /\$scope\b/,
    /\$http\b(?!Client)/,
    /\$routeProvider\b/,
    /\.controller\s*\(/,
    /\.service\s*\(/,
    /\.factory\s*\(/,
    /\.directive\s*\(/,
    /\.filter\s*\(/,
    /ng-app\b/,
    /ng-controller\b/,
    /ng-repeat\b/,
    /ng-if\b/,
    /ng-model\b/,
];

/**
 * Returns true if the code string looks like AngularJS (lenient check — any match).
 * Intended for qualitative analysis where a loose signal is enough.
 * @param {string} code
 * @returns {boolean}
 */
export function looksLikeAngularJS(code) {
    return LOOKSLIKE_PATTERNS.some((p) => p.test(code));
}

/** Patterns used for definitive AngularJS detection (stricter — used by migrate-repo). */
const IS_ANGULARJS_PATTERNS = [
    /angular\.module\s*\(/,
    /\$scope\b/,
    /\$http\b(?!Client)/,
    /\$routeProvider\b/,
    /\$stateProvider\b/,
    /\.controller\s*\(/,
    /\.service\s*\(/,
    /\.factory\s*\(/,
    /\.directive\s*\(/,
    /\.filter\s*\(/,
    /ng-app\b/,
    /ng-controller\b/,
    /ng-repeat\b/,
    /ng-if\b/,
    /ng-model\b/,
    /\$q\b/,
    /\$timeout\b/,
    /\$broadcast\b/,
    /\$emit\b/,
];

/**
 * Returns true if the file content definitively contains AngularJS patterns.
 * Requires at least 2 distinct pattern matches.
 * @param {string} content
 * @returns {boolean}
 */
export function isAngularJS(content) {
    const matches = IS_ANGULARJS_PATTERNS.filter((p) => p.test(content));
    return matches.length >= 2;
}