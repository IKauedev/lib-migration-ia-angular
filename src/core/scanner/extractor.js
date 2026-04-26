/**
 * AngularJS symbol, module, route, and dependency-graph extractor.
 */

// ── Naming convention ─────────────────────────────────────────────────────────

/**
 * Converts an AngularJS camelCase/dot name to a PascalCase Angular class name.
 * e.g. "myUserService" → "MyUserService", "app.main" → "AppMain"
 * @param {string} name
 * @returns {string}
 */
export function toPascalCase(name) {
    return name
        .replace(/[.\-_/]/g, " ")
        .split(/\s+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join("");
}

// ── Module info ───────────────────────────────────────────────────────────────

/**
 * Extracts all angular.module() declarations and references from source.
 * @param {string} content
 * @param {string} relPath
 * @returns {Array<{ moduleName: string, deps: string[], definedIn: string, referenceOnly?: boolean }>}
 */
export function extractModuleInfo(content, relPath) {
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

// ── Symbol extraction ─────────────────────────────────────────────────────────

/**
 * Extracts named AngularJS symbols (.controller, .service, .factory, etc.)
 * and suggests Angular 21 class names for each.
 * @param {string} content
 * @param {string} relPath
 * @returns {Array<{ kind: string, angularName: string, suggestedClassName: string, file: string }>}
 */
export function extractSymbols(content, relPath) {
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

// ── Route extraction ──────────────────────────────────────────────────────────

/**
 * Extracts route definitions from $routeProvider and $stateProvider.
 * @param {string} content
 * @param {string} relPath
 * @returns {Array<object>}
 */
export function extractRoutes(content, relPath) {
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

// ── Dependency graph ──────────────────────────────────────────────────────────

/**
 * Builds a file-level dependency graph from scan results and a symbol registry.
 * @param {Array<object>} fileResults
 * @param {{ symbols: Array<{ angularName: string, file: string }> }} symbolRegistry
 * @returns {Record<string, object>}
 */
export function buildDepsGraph(fileResults, symbolRegistry) {
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