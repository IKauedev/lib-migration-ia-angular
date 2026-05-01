import fs from "node:fs";
import path from "node:path";
import { glob } from "glob";

import {
    shouldSkip,
    detectFileType,
    detectPatterns,
    estimateComplexity,
    detectDependencies,
    detectProblems,
} from "./analyzer.js";

import {
    extractModuleInfo,
    extractSymbols,
    extractRoutes,
    buildDepsGraph,
} from "./extractor.js";

import { getMigrationPhase, estimateHours, PHASE_NAMES } from "./phase-planner.js";



export const ANALYSIS_FILE_NAME = ".ng-migrate-analysis.json";
export const REGISTRY_FILE_NAME = ".ng-migrate-registry.json";
export const DEPS_GRAPH_FILE_NAME = ".ng-migrate-deps-graph.json";



 
export async function scanProject(projectPath, opts = {}) {
    const allRelFiles = await glob("**/*.{js,ts,html}", {
        cwd: projectPath,
        ignore: ["node_modules/**", "dist/**", ".angular/**", "**/*.min.js"],
        absolute: false,
    });

    const fileResults = [];
    let totalLoc = 0;
    let totalEstHours = 0;

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

        const normPath = relPath.replace(/\\/g, "/");
        allSymbols.push(...extractSymbols(content, normPath));
        allModules.push(...extractModuleInfo(content, normPath));
        allRoutes.push(...extractRoutes(content, normPath));

        fileResults.push({
            path: normPath,
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


    fileResults.sort((a, b) =>
        a.phase !== b.phase ? a.phase - b.phase : b.loc - a.loc,
    );


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
             
        }
    }

    const angularVersion =
        projectDependencies["angular"] ||
        projectDependencies["angularjs"] ||
        "unknown";


    const migrationPlan = {
        phases: [1, 2, 3, 4, 5, 6]
            .map((i) => ({
                phase: i,
                name: PHASE_NAMES[i],
                files: fileResults.filter((f) => f.phase === i).map((f) => f.path),
            }))
            .filter((p) => p.files.length > 0),
    };


    const dist = {
        alta: fileResults.filter((r) => r.complexity === "alta").length,
        média: fileResults.filter((r) => r.complexity === "média").length,
        baixa: fileResults.filter((r) => r.complexity === "baixa").length,
    };
    const overallComplexity =
        dist.alta > fileResults.length * 0.3 ?
        "alta" :
        dist.média > fileResults.length * 0.5 ?
        "média" :
        "baixa";


    const patternFrequency = {};
    for (const f of fileResults) {
        for (const p of f.patterns) {
            patternFrequency[p] = (patternFrequency[p] || 0) + 1;
        }
    }
    const topPatterns = Object.entries(patternFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([name, count]) => ({ name, count }));


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



 
export function loadAnalysis(projectPath) {
    const f = path.join(projectPath, ANALYSIS_FILE_NAME);
    if (!fs.existsSync(f)) return null;
    try {
        return JSON.parse(fs.readFileSync(f, "utf-8"));
    } catch {
        return null;
    }
}

 
export function saveAnalysis(projectPath, analysis) {
    const { registry, depsGraph, ...core } = analysis;

    const analysisFile = path.join(projectPath, ANALYSIS_FILE_NAME);
    fs.writeFileSync(analysisFile, JSON.stringify(core, null, 2), "utf-8");

    const registryFile = path.join(projectPath, REGISTRY_FILE_NAME);
    fs.writeFileSync(registryFile, JSON.stringify(registry, null, 2), "utf-8");

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
