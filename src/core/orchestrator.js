import fs from "node:fs";
import path from "node:path";
import {
  resolveTier,
  resolveTokenBudget,
  contentHash,
  MODEL_TIERS,
} from "./persona/migration-persona.js";
import { dbg } from "../utils/debug.js";

export { MODEL_TIERS };

 
const CACHE_FILE_NAME = ".ng-migrate-cache.json";

export class MigrationOrchestrator {
   
  constructor(projectPath, outputDir) {
    this.projectPath = projectPath;
    this.outputDir = outputDir;
    this.cachePath = path.join(projectPath, CACHE_FILE_NAME);

     
    this._cache = this._loadCache();

    this._stats = {
      cacheHits: 0,
      [MODEL_TIERS.FAST]: 0,
      [MODEL_TIERS.STANDARD]: 0,
      [MODEL_TIERS.PREMIUM]: 0,
    };
  }



   
  _loadCache() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.cachePath, "utf-8"));
      return new Map(Object.entries(raw));
    } catch {
      return new Map();
    }
  }

   
  saveCache() {
    try {
      const tmp = this.cachePath + ".tmp";
      fs.writeFileSync(
        tmp,
        JSON.stringify(Object.fromEntries(this._cache), null, 2),
        "utf-8",
      );
      fs.renameSync(tmp, this.cachePath);
      dbg(`[orchestrator] cache salvo — ${this._cache.size} entradas`);
    } catch {
       
    }
  }

   
  getCached(filePath, code) {
    const entry = this._cache.get(filePath);
    if (!entry || entry.hash !== contentHash(code)) return null;
    this._stats.cacheHits++;
    dbg(`[orchestrator] cache hit: ${filePath}`);
    return entry.result;
  }

   
  setCached(filePath, code, result) {
    this._cache.set(filePath, { hash: contentHash(code), result });
  }



   
  resolveModelConfig(fileInfo, code) {
    const tier = resolveTier(fileInfo);
    const maxTokens = resolveTokenBudget(code, tier);
    this._stats[tier] = (this._stats[tier] ?? 0) + 1;
    dbg(
      `[orchestrator] ${fileInfo.path ?? ""} → tier=${tier} | maxTokens=${maxTokens}`,
    );
    return { tier, maxTokens };
  }



   
  warmPhaseContexts(phaseFiles, depsGraph, projectContext) {
    const contexts = new Map();
    for (const fileInfo of phaseFiles) {
      try {
        contexts.set(
          fileInfo.path,
          projectContext.buildContextForFile(fileInfo, depsGraph),
        );
      } catch {
        contexts.set(fileInfo.path, "");
      }
    }
    dbg(`[orchestrator] ${contexts.size} contextos pré-aquecidos para a fase`);
    return contexts;
  }



   
  getStats() {
    return { ...this._stats };
  }

   
  clearCache() {
    this._cache.clear();
    try {
      if (fs.existsSync(this.cachePath)) fs.unlinkSync(this.cachePath);
    } catch {
       
    }
  }
}
