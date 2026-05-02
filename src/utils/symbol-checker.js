/**
 * symbol-checker.js
 * Detecta colisões de nomes de classe (símbolos) entre arquivos migrados.
 * Previne que dois arquivos exportem a mesma classe Angular.
 */

import { dbg } from "./debug.js";

/**
 * @typedef {Object} SymbolCollision
 * @property {string} className - Nome da classe duplicada
 * @property {string[]} files - Arquivos que definem o mesmo símbolo
 * @property {string} type - Tipo do símbolo (service, component, pipe, etc.)
 */

/**
 * Detecta colisões de nome de classe no registry de símbolos.
 *
 * @param {Object} registry - Registry carregado de .ng-migrate-registry.json
 * @returns {{ collisions: SymbolCollision[], hasCollisions: boolean }}
 */
export function detectSymbolCollisions(registry) {
  if (!registry?.symbols?.length) {
    return { collisions: [], hasCollisions: false };
  }

  /** @type {Map<string, Array<{file: string, type: string}>>} */
  const classNameMap = new Map();

  for (const sym of registry.symbols) {
    const cls = sym.suggestedClassName || sym.angularName;
    if (!cls) continue;

    if (!classNameMap.has(cls)) {
      classNameMap.set(cls, []);
    }
    classNameMap
      .get(cls)
      .push({ file: sym.file || "unknown", type: sym.kind || "unknown" });
  }

  const collisions = [];
  for (const [className, entries] of classNameMap) {
    if (entries.length > 1) {
      collisions.push({
        className,
        files: entries.map((e) => e.file),
        type: entries[0].type,
      });
    }
  }

  if (collisions.length > 0) {
    dbg(
      `[symbol-checker] ${collisions.length} colisão(ões) detectada(s): ${collisions.map((c) => c.className).join(", ")}`,
    );
  }

  return { collisions, hasCollisions: collisions.length > 0 };
}

/**
 * Resolve colisões adicionando sufixo numérico ou de módulo às classes duplicadas.
 *
 * @param {Object} registry - Registry de símbolos
 * @param {SymbolCollision[]} collisions - Colisões detectadas
 * @returns {Object} Registry com nomes corrigidos
 */
export function resolveCollisions(registry, collisions) {
  if (!collisions.length) return registry;

  const resolved = JSON.parse(JSON.stringify(registry)); // deep clone

  for (const collision of collisions) {
    const { className, files } = collision;
    dbg(
      `[symbol-checker] resolvendo colisão: ${className} (${files.length} arquivos)`,
    );

    let counter = 2;
    for (const sym of resolved.symbols) {
      const cls = sym.suggestedClassName || sym.angularName;
      if (cls === className) {
        if (counter > 2) {
          // Rename from second occurrence onward
          const newName = `${className}${counter}`;
          sym.suggestedClassName = newName;
          // Update renameMap if it exists
          if (resolved.renameMap) {
            resolved.renameMap[sym.angularName] = newName;
          }
          dbg(`[symbol-checker]   ${sym.file}: ${className} → ${newName}`);
        }
        counter++;
      }
    }
  }

  return resolved;
}

/**
 * Gera um relatório textual das colisões encontradas.
 *
 * @param {SymbolCollision[]} collisions
 * @returns {string}
 */
export function formatCollisionReport(collisions) {
  if (!collisions.length) return "";

  const lines = [
    `⚠  ${collisions.length} colisão(ões) de nome de classe detectada(s):`,
  ];

  for (const c of collisions) {
    lines.push(`  • ${c.className} (${c.type})`);
    for (const f of c.files) {
      lines.push(`      - ${f}`);
    }
  }

  lines.push(
    "  Os nomes duplicados foram automaticamente resolvidos com sufixo numérico.",
  );
  return lines.join("\n");
}

/**
 * Verifica se um conjunto de arquivos migrados tem conflitos de export.
 * Analisa o código TypeScript gerado buscando `export class X`.
 *
 * @param {Array<{path: string, code: string}>} migratedFiles
 * @returns {{ collisions: SymbolCollision[], hasCollisions: boolean }}
 */
export function detectExportCollisions(migratedFiles) {
  const exportMap = new Map();

  for (const { path: filePath, code } of migratedFiles) {
    if (!code) continue;
    const matches = code.matchAll(
      /export\s+(?:default\s+)?(?:abstract\s+)?class\s+(\w+)/g,
    );
    for (const m of matches) {
      const className = m[1];
      if (!exportMap.has(className)) exportMap.set(className, []);
      exportMap.get(className).push(filePath);
    }
  }

  const collisions = [];
  for (const [className, files] of exportMap) {
    if (files.length > 1) {
      collisions.push({ className, files, type: "export" });
    }
  }

  return { collisions, hasCollisions: collisions.length > 0 };
}
