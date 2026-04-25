import fs from "fs";
import path from "path";
import { glob } from "glob";

export const ANALYSIS_FILE_NAME = ".ng-migrate-analysis.json";
export const REGISTRY_FILE_NAME = ".ng-migrate-registry.json";
export const DEPS_GRAPH_FILE_NAME = ".ng-migrate-deps-graph.json";

// ── Pattern registry ──────────────────────────────────────────────────────────

const NG_PATTERNS = [
  { name: "$scope", regex: /\$scope\b/, weight: 2 },
  { name: "$http", regex: /\$http\b(?!Client)/, weight: 2 },
  { name: "angular.module", regex: /angular\.module\s*\(/, weight: 3 },
  { name: ".controller()", regex: /\.controller\s*\(/, weight: 3 },
  { name: ".service()", regex: /\.service\s*\(/, weight: 2 },
  { name: ".factory()", regex: /\.factory\s*\(/, weight: 2 },
  { name: ".directive()", regex: /\.directive\s*\(/, weight: 3 },
  { name: ".filter()", regex: /\.filter\s*\(/, weight: 1 },
  { name: ".component()", regex: /\.component\s*\(/, weight: 2 },
  { name: "$routeProvider", regex: /\$routeProvider/, weight: 3 },
  { name: "$stateProvider", regex: /\$stateProvider/, weight: 3 },
  { name: "$q", regex: /\$q\./, weight: 2 },
  { name: "$timeout", regex: /\$timeout\b/, weight: 1 },
  { name: "$broadcast/$emit", regex: /\$broadcast|\$emit\b/, weight: 2 },
  { name: "$watch", regex: /\$watch\s*\(/, weight: 2 },
  { name: "$rootScope", regex: /\$rootScope\b/, weight: 2 },
  { name: "$compile", regex: /\$compile\b/, weight: 3 },
  { name: "ng-repeat", regex: /ng-repeat|ng:repeat/, weight: 1 },
  { name: "ng-if", regex: /ng-if\b|ng:if\b/, weight: 1 },
  { name: "ng-model", regex: /ng-model\b|ng:model\b/, weight: 1 },
  { name: "ng-controller", regex: /ng-controller\b/, weight: 2 },
  { name: "ng-app", regex: /ng-app\b/, weight: 3 },
  { name: "ng-show/ng-hide", regex: /ng-show|ng-hide/, weight: 1 },
  { name: "ng-click", regex: /ng-click\b/, weight: 1 },
  { name: "templateUrl", regex: /templateUrl\s*:/, weight: 1 },
  { name: "link function", regex: /link\s*:\s*function/, weight: 2 },
  { name: "angular.element", regex: /angular\.element\b/, weight: 1 },
  { name: "$sce", regex: /\$sce\b/, weight: 2 },
];

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
];

// ── Symbol extractors ─────────────────────────────────────────────────────────

/**
 * Convert an AngularJS camelCase/dot name to a PascalCase Angular class name.
 * e.g. "myUserService" → "MyUserService", "app.main" → "AppMain"
 */
function toPascalCase(name) {
  return name
    .replace(/[.\-_/]/g, " ")
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

/**
 * Extract all angular.module() declarations and registrations from source.
 * Returns: { moduleName, deps[], controllers[], services[], factories[],
 *            directives[], filters[], components[], providers[] }
 */
function extractModuleInfo(content, relPath) {
  const modules = [];

  // angular.module('name', [...deps]) — definition
  for (const m of content.matchAll(
    /angular\.module\s*\(\s*['"]([^'"]+)['"]\s*,\s*\[([^\]]*)\]/g,
  )) {
    const moduleName = m[1];
    const rawDeps = m[2].match(/['"]([^'"]+)['"]/g) || [];
    const deps = rawDeps.map((d) => d.replace(/['"]/g, ""));
    modules.push({ moduleName, deps, definedIn: relPath });
  }

  // angular.module('name') — reference (no deps array)
  for (const m of content.matchAll(
    /angular\.module\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  )) {
    if (!modules.find((mod) => mod.moduleName === m[1])) {
      modules.push({
        moduleName: m[1],
        deps: [],
        definedIn: relPath,
        referenceOnly: true,
      });
    }
  }

  return modules;
}

/**
 * Extract named symbols (.controller, .service, .factory, .directive, .filter, .component)
 * Returns array of { kind, angularName, suggestedClassName, file }
 */
function extractSymbols(content, relPath) {
  const symbols = [];
  const kindMap = {
    controller: "Controller",
    service: "Service",
    factory: "Service",
    directive: "Directive",
    filter: "Pipe",
    component: "Component",
    provider: "Service",
  };

  for (const [kind, suffix] of Object.entries(kindMap)) {
    const re = new RegExp(`\\.${kind}\\s*\\(\\s*['"]([^'"]+)['"]`, "g");
    for (const m of content.matchAll(re)) {
      const angularName = m[1];
      const base = toPascalCase(angularName);
      const suggestedClassName = base.endsWith(suffix) ? base : base + suffix;
      symbols.push({ kind, angularName, suggestedClassName, file: relPath });
    }
  }

  return symbols;
}

/**
 * Extract route definitions ($routeProvider / $stateProvider).
 * Returns array of { path, controller, templateUrl, stateName }
 */
function extractRoutes(content, relPath) {
  const routes = [];

  // $routeProvider.when('/path', { controller: 'X', templateUrl: 'y.html' })
  for (const m of content.matchAll(
    /\.when\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{([^}]+)\}/g,
  )) {
    const routePath = m[1];
    const body = m[2];
    const ctrl = (body.match(/controller\s*:\s*['"]([^'"]+)['"]/) || [])[1];
    const tmpl = (body.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/) || [])[1];
    routes.push({
      type: "ngRoute",
      path: routePath,
      controller: ctrl,
      templateUrl: tmpl,
      definedIn: relPath,
    });
  }

  // $stateProvider.state('name', { url: '...', controller: '...', templateUrl: '...' })
  for (const m of content.matchAll(
    /\.state\s*\(\s*['"]([^'"]+)['"]\s*,\s*\{([^}]+)\}/g,
  )) {
    const stateName = m[1];
    const body = m[2];
    const url = (body.match(/url\s*:\s*['"]([^'"]+)['"]/) || [])[1];
    const ctrl = (body.match(/controller\s*:\s*['"]([^'"]+)['"]/) || [])[1];
    const tmpl = (body.match(/templateUrl\s*:\s*['"]([^'"]+)['"]/) || [])[1];
    routes.push({
      type: "uiRouter",
      stateName,
      url,
      controller: ctrl,
      templateUrl: tmpl,
      definedIn: relPath,
    });
  }

  return routes;
}

/**
 * Build a simple file-level dependency graph.
 * Maps each file to the set of AngularJS symbol names it injects.
 */
function buildDepsGraph(fileResults, symbolRegistry) {
  // Build lookup: angularName → file
  const symbolToFile = {};
  for (const sym of symbolRegistry.symbols) {
    symbolToFile[sym.angularName] = sym.file;
  }

  const graph = {};
  for (const f of fileResults) {
    const deps = f.dependencies.filter((d) => symbolToFile[d]);
    graph[f.path] = {
      type: f.type,
      phase: f.phase,
      injects: f.dependencies,
      dependsOnFiles: [...new Set(deps.map((d) => symbolToFile[d]))],
    };
  }
  return graph;
}

// ── Static helpers ────────────────────────────────────────────────────────────

function shouldSkip(relPath) {
  const norm = relPath.replace(/\\/g, "/");
  return SKIP_PATTERNS.some((p) => p.test(norm));
}

function detectFileType(content) {
  if (/\.controller\s*\(/.test(content)) return "controller";
  if (/\.service\s*\(/.test(content)) return "service";
  if (/\.factory\s*\(/.test(content)) return "factory";
  if (/\.filter\s*\(/.test(content)) return "filter";
  if (/\.directive\s*\(/.test(content)) return "directive";
  if (/\.component\s*\(/.test(content)) return "component";
  if (/\$routeProvider|\$stateProvider/.test(content)) return "routing";
  if (/ng-app\b|ng-controller\b/.test(content)) return "template";
  if (/angular\.module\s*\(/.test(content)) return "module";
  return "unknown";
}

function detectPatterns(content) {
  return NG_PATTERNS.filter((p) => p.regex.test(content)).map((p) => p.name);
}

function estimateComplexity(content, patterns) {
  const loc = content.split("\n").length;
  const weight = patterns.reduce((s, name) => {
    const found = NG_PATTERNS.find((x) => x.name === name);
    return s + (found?.weight || 1);
  }, 0);
  const score = loc * 0.08 + weight * 2.5;
  if (score < 14) return "baixa";
  if (score < 38) return "média";
  return "alta";
}

function detectDependencies(content) {
  const deps = new Set();

  // Array DI notation: ['$http', '$scope', function(...)]
  for (const m of content.matchAll(/\[([^\]]+),\s*function/g)) {
    m[1]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .forEach((d) => {
        if (d.startsWith("$") || /^[A-Z]/.test(d)) deps.add(d);
      });
  }
  // $inject notation
  const injectMatch = content.match(/\.\$inject\s*=\s*\[([^\]]+)\]/);
  if (injectMatch) {
    injectMatch[1]
      .split(",")
      .map((s) => s.trim().replace(/['"]/g, ""))
      .forEach((d) => deps.add(d));
  }
  // Constructor DI (TypeScript-style AngularJS)
  for (const m of content.matchAll(/constructor\s*\(([^)]+)\)/g)) {
    m[1]
      .split(",")
      .map((s) =>
        s
          .trim()
          .replace(/.*:\s*/, "")
          .replace(/['"]/g, ""),
      )
      .forEach((d) => {
        if (d.startsWith("$") || /^[A-Z]/.test(d)) deps.add(d);
      });
  }
  return [...deps];
}

function getMigrationPhase(type) {
  const map = {
    factory: 1,
    service: 1,
    filter: 2,
    directive: 3,
    component: 3,
    controller: 4,
    template: 5,
    routing: 6,
    module: 6,
    unknown: 4,
  };
  return map[type] ?? 4;
}

function estimateHours(complexity, loc) {
  const base = complexity === "alta" ? 3.5 : complexity === "média" ? 1.5 : 0.5;
  const locFactor = Math.max(1, loc / 100);
  return Math.round(base * locFactor * 10) / 10;
}

function detectProblems(content, patterns) {
  const problems = [];
  if (patterns.includes("$rootScope"))
    problems.push("$rootScope: use Signals ou serviço singleton");
  if (patterns.includes("$compile"))
    problems.push("$compile: substitua por ViewContainerRef.createComponent()");
  if (patterns.includes("$sce"))
    problems.push("$sce.trustAs: substitua por DomSanitizer");
  if (patterns.includes("templateUrl"))
    problems.push("templateUrl externo: inline o template ou use lazy loading");
  if (patterns.includes("link function"))
    problems.push("link function: refatore para OnInit/OnChanges");
  if (patterns.includes("angular.element"))
    problems.push("angular.element: use ElementRef/Renderer2");
  if (content.includes("$scope.$apply"))
    problems.push("$scope.$apply: remover após migrar para signals");
  if (content.includes("$$"))
    problems.push("Acesso a propriedades internas ($$): remover");
  if (content.includes("$interpolate"))
    problems.push("$interpolate: use template literals ou pipes");
  if (content.includes("angular.copy"))
    problems.push("angular.copy: use structuredClone() ou spread operator");
  if (content.includes("angular.extend"))
    problems.push("angular.extend: use Object.assign() ou spread");
  if (content.includes("angular.forEach"))
    problems.push("angular.forEach: use Array.forEach()");
  return problems;
}

// ── Main scanner ──────────────────────────────────────────────────────────────

/**
 * Scan a project directory and return a structured analysis object.
 * @param {string} projectPath  Absolute path to the project root.
 * @param {{ includeAll?: boolean }} opts
 * @returns {Promise<object>}
 */
export async function scanProject(projectPath, opts = {}) {
  const allRelFiles = await glob("**/*.{js,ts,html}", {
    cwd: projectPath,
    ignore: ["node_modules/**", "dist/**", ".angular/**", "**/*.min.js"],
    absolute: false,
  });

  const fileResults = [];
  let totalLoc = 0;
  let totalEstHours = 0;

  // Symbol / module / route accumulators
  const allSymbols = [];
  const allModules = [];
  const allRoutes = [];

  for (const relPath of allRelFiles) {
    if (shouldSkip(relPath)) continue;

    const absPath = path.join(projectPath, relPath);
    let content;
    try {
      content = fs.readFileSync(absPath, "utf-8");
    } catch {
      continue;
    }

    const patterns = detectPatterns(content);
    if (patterns.length === 0 && !opts.includeAll) continue;

    const loc = content.split("\n").length;
    const type = detectFileType(content);
    const complexity = estimateComplexity(content, patterns);
    const deps = detectDependencies(content);
    const phase = getMigrationPhase(type);
    const estHours = estimateHours(complexity, loc);
    const problems = detectProblems(content, patterns);

    totalLoc += loc;
    totalEstHours += estHours;

    // Collect symbols, modules and routes from this file
    allSymbols.push(...extractSymbols(content, relPath.replace(/\\/g, "/")));
    allModules.push(...extractModuleInfo(content, relPath.replace(/\\/g, "/")));
    allRoutes.push(...extractRoutes(content, relPath.replace(/\\/g, "/")));

    fileResults.push({
      path: relPath.replace(/\\/g, "/"),
      type,
      complexity,
      loc,
      patterns,
      dependencies: deps,
      problems,
      phase,
      estimatedHours: estHours,
    });
  }

  // Sort by phase asc, then by LOC desc (larger files first within same phase)
  fileResults.sort((a, b) =>
    a.phase !== b.phase ? a.phase - b.phase : b.loc - a.loc,
  );

  // Read package.json for dependency info
  let projectDependencies = {};
  const pkgPath = path.join(projectPath, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
      projectDependencies = {
        ...(pkg.dependencies || {}),
        ...(pkg.devDependencies || {}),
      };
    } catch {
      /* ignore */
    }
  }

  const angularVersion =
    projectDependencies["angular"] ||
    projectDependencies["angularjs"] ||
    "unknown";

  // Build migration plan (phases)
  const phaseNames = [
    "",
    "Services & Factories",
    "Filters → Pipes",
    "Directives & Components",
    "Controllers",
    "Templates",
    "Roteamento & Módulos",
  ];
  const migrationPlan = {
    phases: [1, 2, 3, 4, 5, 6]
      .map((i) => ({
        phase: i,
        name: phaseNames[i],
        files: fileResults.filter((f) => f.phase === i).map((f) => f.path),
      }))
      .filter((p) => p.files.length > 0),
  };

  // Complexity distribution
  const dist = {
    alta: fileResults.filter((r) => r.complexity === "alta").length,
    média: fileResults.filter((r) => r.complexity === "média").length,
    baixa: fileResults.filter((r) => r.complexity === "baixa").length,
  };
  const overallComplexity =
    dist.alta > fileResults.length * 0.3
      ? "alta"
      : dist.média > fileResults.length * 0.5
        ? "média"
        : "baixa";

  // Top patterns across all files
  const patternFrequency = {};
  fileResults.forEach((f) =>
    f.patterns.forEach((p) => {
      patternFrequency[p] = (patternFrequency[p] || 0) + 1;
    }),
  );
  const topPatterns = Object.entries(patternFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count }));

  // ── Build registry ────────────────────────────────────────────────────────
  const symbolRegistry = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    projectPath,
    symbols: allSymbols,
    modules: allModules,
    routes: allRoutes,
    renameMap: Object.fromEntries(
      allSymbols.map((s) => [s.angularName, s.suggestedClassName]),
    ),
  };

  // ── Build dependency graph ────────────────────────────────────────────────
  const depsGraph = {
    version: "1.0",
    generatedAt: new Date().toISOString(),
    projectPath,
    graph: buildDepsGraph(fileResults, symbolRegistry),
  };

  return {
    version: "1.0",
    projectPath,
    scannedAt: new Date().toISOString(),
    summary: {
      totalFiles: allRelFiles.length,
      angularJsFiles: fileResults.length,
      overallComplexity,
      complexityDistribution: dist,
      totalLoc,
      estimatedHours: Math.round(totalEstHours * 10) / 10,
      angularVersion,
      topPatterns,
    },
    projectDependencies,
    files: fileResults,
    migrationPlan,
    registry: symbolRegistry,
    depsGraph,
  };
}

// ── Persistence helpers ───────────────────────────────────────────────────────

export function loadAnalysis(projectPath) {
  const analysisFile = path.join(projectPath, ANALYSIS_FILE_NAME);
  if (!fs.existsSync(analysisFile)) return null;
  try {
    return JSON.parse(fs.readFileSync(analysisFile, "utf-8"));
  } catch {
    return null;
  }
}

export function saveAnalysis(projectPath, analysis) {
  // Main analysis (without the large embedded objects — keep file lean)
  const { registry, depsGraph, ...core } = analysis;
  const analysisFile = path.join(projectPath, ANALYSIS_FILE_NAME);
  fs.writeFileSync(analysisFile, JSON.stringify(core, null, 2), "utf-8");

  // Symbol registry
  const registryFile = path.join(projectPath, REGISTRY_FILE_NAME);
  fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), "utf-8");

  // Dependency graph
  const graphFile = path.join(projectPath, DEPS_GRAPH_FILE_NAME);
  fs.writeFileSync(graphFile, JSON.stringify(depsGraph, null, 2), "utf-8");

  return { analysisFile, registryFile, graphFile };
}

export function loadRegistry(projectPath) {
  const f = path.join(projectPath, REGISTRY_FILE_NAME);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf-8"));
  } catch {
    return null;
  }
}

export function loadDepsGraph(projectPath) {
  const f = path.join(projectPath, DEPS_GRAPH_FILE_NAME);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, "utf-8"));
  } catch {
    return null;
  }
}
