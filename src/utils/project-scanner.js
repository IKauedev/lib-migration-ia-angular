/**
 * @deprecated Re-exports from src/core/scanner/ for backward compatibility.
 * New code should import directly from "../core/scanner/index.js".
 */
export {
  ANALYSIS_FILE_NAME,
  REGISTRY_FILE_NAME,
  DEPS_GRAPH_FILE_NAME,
  scanProject,
  loadAnalysis,
  saveAnalysis,
  loadRegistry,
  loadDepsGraph,
} from "../core/scanner/index.js";
