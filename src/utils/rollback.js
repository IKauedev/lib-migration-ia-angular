/**
 * rollback.js
 * Gerencia escritas transacionais de arquivos com suporte a rollback.
 * Garante que, se uma fase falhar, apenas os arquivos dessa fase são revertidos.
 */

import fs from "node:fs";
import path from "node:path";
import { dbg } from "./debug.js";

/**
 * @typedef {Object} FileOperation
 * @property {string} path - Caminho do arquivo escrito
 * @property {string|null} originalContent - Conteúdo original (null se arquivo novo)
 * @property {boolean} wasNew - Se o arquivo foi criado (não existia antes)
 */

export class RollbackManager {
  constructor() {
    /** @type {FileOperation[]} */
    this._operations = [];
    /** @type {Map<string, FileOperation[]>} */
    this._phaseOperations = new Map();
    this._currentPhase = null;
  }

  /**
   * Define a fase atual (para rollback por fase).
   * @param {string|number} phase
   */
  beginPhase(phase) {
    this._currentPhase = String(phase);
    if (!this._phaseOperations.has(this._currentPhase)) {
      this._phaseOperations.set(this._currentPhase, []);
    }
    dbg(`[rollback] iniciando fase: ${phase}`);
  }

  /**
   * Registra uma operação de escrita antes de executá-la.
   * @param {string} filePath - Caminho absoluto do arquivo
   */
  registerWrite(filePath) {
    let originalContent = null;
    let wasNew = false;

    if (fs.existsSync(filePath)) {
      try {
        originalContent = fs.readFileSync(filePath, "utf-8");
      } catch {
        /* ignore — will be treated as new */
      }
    } else {
      wasNew = true;
    }

    const op = { path: filePath, originalContent, wasNew };
    this._operations.push(op);

    if (this._currentPhase && this._phaseOperations.has(this._currentPhase)) {
      this._phaseOperations.get(this._currentPhase).push(op);
    }

    dbg(
      `[rollback] registrado: ${filePath} (${wasNew ? "novo" : "sobrescrita"})`,
    );
  }

  /**
   * Reverte todas as operações de uma fase específica.
   * @param {string|number} phase
   * @returns {number} Número de arquivos revertidos
   */
  rollbackPhase(phase) {
    const ops = this._phaseOperations.get(String(phase)) || [];
    return this._rollbackOps(ops);
  }

  /**
   * Reverte TODAS as operações registradas.
   * @returns {number} Número de arquivos revertidos
   */
  rollbackAll() {
    return this._rollbackOps([...this._operations]);
  }

  /**
   * Descarta o histórico de uma fase (após sucesso).
   * @param {string|number} phase
   */
  commitPhase(phase) {
    this._phaseOperations.delete(String(phase));
    dbg(`[rollback] fase ${phase} confirmada (commit)`);
  }

  /**
   * Descarta todo o histórico (migração completa com sucesso).
   */
  commitAll() {
    this._operations = [];
    this._phaseOperations.clear();
    dbg("[rollback] todas as operações confirmadas");
  }

  /**
   * Retorna estatísticas das operações registradas.
   */
  stats() {
    return {
      total: this._operations.length,
      newFiles: this._operations.filter((o) => o.wasNew).length,
      overwrites: this._operations.filter((o) => !o.wasNew).length,
      phases: [...this._phaseOperations.keys()],
    };
  }

  /** @private */
  _rollbackOps(ops) {
    let count = 0;
    // Revert in reverse order (LIFO)
    for (const op of [...ops].reverse()) {
      try {
        if (op.wasNew) {
          // File was created by migration — delete it
          if (fs.existsSync(op.path)) {
            fs.unlinkSync(op.path);
            dbg(`[rollback] deletado (era novo): ${op.path}`);
          }
        } else if (op.originalContent !== null) {
          // File was overwritten — restore original
          fs.mkdirSync(path.dirname(op.path), { recursive: true });
          fs.writeFileSync(op.path, op.originalContent, "utf-8");
          dbg(`[rollback] restaurado: ${op.path}`);
        }
        count++;
      } catch (err) {
        dbg(`[rollback] ERRO ao reverter ${op.path}: ${err.message}`);
      }
    }
    dbg(`[rollback] ${count} arquivo(s) revertidos`);
    return count;
  }
}

/**
 * Escrita atômica via arquivo temporário + rename.
 * Previne arquivos corrompidos em caso de crash.
 *
 * @param {string} filePath - Destino final
 * @param {string} content - Conteúdo a escrever
 * @param {RollbackManager|null} rollback - Gerenciador de rollback (opcional)
 */
export function atomicWrite(filePath, content, rollback = null) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (rollback) {
    rollback.registerWrite(filePath);
  }

  const tmp = filePath + ".tmp." + process.pid;
  try {
    fs.writeFileSync(tmp, content, "utf-8");
    fs.renameSync(tmp, filePath);
  } catch (err) {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw err;
  }
}
