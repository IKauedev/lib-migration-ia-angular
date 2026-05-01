import path from "node:path";

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

export function shouldSkip(filePath) {
  const norm = filePath.replace(/\\/g, "/");
  return SKIP_PATTERNS.some((p) => p.test(norm));
}

export function matchesOnly(filePath, only) {
  if (!only) return true;
  const patterns = Array.isArray(only)
    ? only
    : only.split(",").map((s) => s.trim());
  const base = path.basename(filePath);
  return patterns.some((pat) => {
    const escaped = pat.replace(/\./g, "\\.").replace(/\*/g, ".*");
    return new RegExp(escaped, "i").test(base);
  });
}

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

export function looksLikeAngularJS(code) {
  return LOOKSLIKE_PATTERNS.some((p) => p.test(code));
}

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

export function isAngularJS(content) {
  const matches = IS_ANGULARJS_PATTERNS.filter((p) => p.test(content));
  return matches.length >= 2;
}
