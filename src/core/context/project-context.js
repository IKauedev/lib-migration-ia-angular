import fs from "node:fs";
import path from "node:path";
import {
  HumanMessage,
  AIMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { buildModel, TASK_TYPES } from "../../providers/langchain.js";
import { dbg } from "../../utils/debug.js";



 
export const CHECKPOINT_FILE_NAME = ".ng-migrate-checkpoint.json";

 
const CHECKPOINT_VERSION = 1;



 
const MAX_HISTORY_MESSAGES = 30;

 
const KEEP_RECENT = 10;



export class ProjectMigrationContext {
   
  constructor(projectPath) {
    this.projectPath = projectPath;
    this.projectName = path.basename(projectPath);


     
    this.messages = [];


     
    this.symbolMap = new Map();


     
    this.migratedFiles = [];


     
    this.projectSummary = null;
     
    this.detectedModules = [];
     
    this.routes = [];
     
    this.globalPatterns = new Set();


    this.historySummary = "";


    this.totalFiles = 0;
    this.completedFiles = 0;
  }



   
  initFromAnalysis(analysis, registry, depsGraph) {
    if (!analysis) return;

    this.projectSummary = analysis.summary || null;
    this.totalFiles = analysis.files?.length || 0;


    if (analysis.files) {
      for (const f of analysis.files) {
        if (f.patterns) f.patterns.forEach((p) => this.globalPatterns.add(p));
      }
    }


    if (registry) {
      this.detectedModules = registry.modules || [];
      this.routes = registry.routes || [];

      if (Array.isArray(registry.symbols)) {
        for (const sym of registry.symbols) {
          this.symbolMap.set(sym.angularName, {
            className: sym.suggestedClassName || sym.angularName,
            file: sym.file || "",
            type: sym.type || "unknown",
            migrated: false,
          });
        }
      }


      if (registry.renameMap && typeof registry.renameMap === "object") {
        for (const [oldName, newName] of Object.entries(registry.renameMap)) {
          if (!this.symbolMap.has(oldName)) {
            this.symbolMap.set(oldName, {
              className: newName,
              file: "",
              type: "unknown",
              migrated: false,
            });
          }
        }
      }
    }


    const initMsg = this._buildProjectInitMessage(analysis, registry);
    this.messages.push(new SystemMessage(initMsg));

    dbg(
      `[context] inicializado — arquivos: ${this.totalFiles} | símbolos: ${this.symbolMap.size} | módulos: ${this.detectedModules.length}`,
    );
  }

   
  _buildProjectInitMessage(analysis, registry) {
    const s = analysis?.summary || {};
    const lines = [
      `=== CONTEXTO DO PROJETO: ${this.projectName} ===`,
      `Migração de AngularJS (Angular 1.x) → Angular 21 com standalone components e Signals.`,
      `Arquivos totais: ${s.totalFiles ?? "?"} | Arquivos AngularJS: ${s.angularJsFiles ?? "?"}`,
      `Complexidade geral: ${s.overallComplexity ?? "?"} | Horas estimadas: ~${s.estimatedHours ?? "?"}h`,
    ];

    const patternsArr = [...this.globalPatterns];
    if (patternsArr.length > 0) {
      lines.push(
        `\nPadrões AngularJS detectados no projeto: ${patternsArr.slice(0, 15).join(", ")}${patternsArr.length > 15 ? "…" : ""}`,
      );
    }

    if (this.detectedModules.length > 0) {
      lines.push(`\nMódulos AngularJS: ${this.detectedModules.join(", ")}`);
    }

    if (this.routes.length > 0) {
      const shown = this.routes.slice(0, 12);
      lines.push(`\nRotas detectadas (${this.routes.length}):`);
      for (const r of shown) {
        const url =
          r.path ?? r.url ?? (typeof r === "string" ? r : (r.name ?? "?"));
        const ctrl = r.controller || r.component || "?";
        lines.push(`  ${url}  →  ${ctrl}`);
      }
      if (this.routes.length > 12)
        lines.push(`  … e mais ${this.routes.length - 12}`);
    }

    if (this.symbolMap.size > 0) {
      lines.push(`\nMapeamento de símbolos (${this.symbolMap.size}):`);
      let count = 0;
      for (const [old, info] of this.symbolMap) {
        lines.push(`  ${old}  →  ${info.className} (${info.type})`);
        if (++count >= 25) {
          lines.push(`  … e mais ${this.symbolMap.size - 25}`);
          break;
        }
      }
    }

    lines.push(
      `\nIMPORTANTE: use SEMPRE os nomes de classe acima ao referenciar dependências migradas.`,
      `Siga as convenções Angular 21: standalone components, Signals, inject(), nova sintaxe de template.`,
    );

    return lines.join("\n");
  }



   
  buildContextForFile(fileInfo, depsGraph) {
    const lines = [];


    const fileDeps = depsGraph?.graph?.[fileInfo.path]?.injects || [];
    const relevantSymbols = [];
    for (const dep of fileDeps) {
      const info = this.symbolMap.get(dep);
      if (info) {
        const migratedNote =
          info.migrated && info.migratedPath
            ? ` (já migrado → ${info.migratedPath})`
            : "";
        relevantSymbols.push(`  ${dep}  →  ${info.className}${migratedNote}`);
      }
    }
    if (relevantSymbols.length > 0) {
      lines.push(
        `Dependências injetadas neste arquivo (use EXATAMENTE esses nomes Angular):\n${relevantSymbols.join("\n")}`,
      );
    }


    const ownSym = this._findSymbolForFile(fileInfo.path);
    if (ownSym) {
      lines.push(
        `Este arquivo deve exportar a classe Angular: ${ownSym.className} (tipo: ${ownSym.type})`,
      );
    }


    if (this.migratedFiles.length > 0) {
      const recent = this.migratedFiles.slice(-8);
      lines.push(
        `\nArquivos já migrados (${this.completedFiles}/${this.totalFiles} total):`,
      );
      for (const f of recent) {
        const cls = f.className ? ` → classe: ${f.className}` : "";
        lines.push(`  ${f.originalPath} → ${f.migratedPath} (${f.type})${cls}`);
      }
    }


    if (this.historySummary) {
      lines.push(`\nResumo do progresso acumulado:\n${this.historySummary}`);
    }


    lines.push(
      `\nProgresso: ${this.completedFiles}/${this.totalFiles} | Fase: ${fileInfo.phase ?? "?"} | Tipo: ${fileInfo.type ?? "auto"} | Complexidade: ${fileInfo.complexity ?? "?"}`,
    );

    return lines.join("\n");
  }

   
  _findSymbolForFile(filePath) {
    if (!filePath) return null;
    for (const [angularName, info] of this.symbolMap) {
      if (info.file === filePath) return { angularName, ...info };
    }
    return null;
  }



   
  getMessageHistory() {
    return [...this.messages];
  }



   
  recordMigration(fileInfo, migratedCode, result) {
    this.completedFiles++;

    const outRelPath = fileInfo.path.replace(/\.js$/, ".ts");
    const detectedClass = this._extractClassName(migratedCode);

    const record = {
      originalPath: fileInfo.path,
      migratedPath: outRelPath,
      type: result?.tipo || fileInfo.type || "unknown",
      className: detectedClass,
      patterns: result?.padroes || [],
      changes: result?.mudancas?.slice(0, 5) || [],
    };

    this.migratedFiles.push(record);


    const ownSym = this._findSymbolForFile(fileInfo.path);
    if (ownSym && detectedClass) {
      const info = this.symbolMap.get(ownSym.angularName);
      if (info) {
        info.migrated = true;
        info.migratedPath = outRelPath;
        info.className = detectedClass;
      }
    }


    const humanText = `Arquivo migrado: ${fileInfo.path} (tipo: ${record.type})`;
    const aiText = [
      `✓ ${record.originalPath} → ${record.migratedPath}`,
      detectedClass ? `Classe gerada: ${detectedClass}` : null,
      record.changes.length ? `Mudanças: ${record.changes.join("; ")}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    this.messages.push(new HumanMessage(humanText), new AIMessage(aiText));


    const nonSystem = this.messages.filter(
      (m) => !(m instanceof SystemMessage),
    );
    if (nonSystem.length > MAX_HISTORY_MESSAGES) {
      this._condenseHistory();
    }

    dbg(
      `[context] registrado: ${fileInfo.path} → ${detectedClass ?? "?"} (${record.type}) | total: ${this.completedFiles}/${this.totalFiles}`,
    );
  }

   
  _extractClassName(code) {
    if (!code || typeof code !== "string") return null;

    const decorated =
      /(?:@Component|@Injectable|@Pipe|@Directive)\s*\([^)]*\)\s*(?:\/\/[^\n]*)?\s*export\s+(?:default\s+)?class\s+(\w+)/s.exec(
        code,
      );
    if (decorated) return decorated[1];

    const exported = /export\s+(?:default\s+)?class\s+(\w+)/.exec(code);
    return exported ? exported[1] : null;
  }



   
  _condenseHistory() {
    const systemMsgs = this.messages.filter((m) => m instanceof SystemMessage);
    const nonSystem = this.messages.filter(
      (m) => !(m instanceof SystemMessage),
    );

    const toCondense = nonSystem.slice(0, -KEEP_RECENT);
    const toKeep = nonSystem.slice(-KEEP_RECENT);

    if (toCondense.length === 0) return;


    const summaryLines = [
      `Resumo de ${Math.floor(toCondense.length / 2)} arquivo(s) migrado(s) anteriormente:`,
    ];
    for (let i = 0; i < toCondense.length; i += 2) {
      const aiMsg = toCondense[i + 1];
      if (aiMsg) summaryLines.push(`  - ${aiMsg.content.split("\n")[0]}`);
    }
    this.historySummary = summaryLines.join("\n");


    this.messages = [...systemMsgs, ...toKeep];

    dbg(
      `[context] histórico condensado: ${Math.floor(toCondense.length / 2)} entradas → resumo sync`,
    );
  }

   
  async condenseHistoryWithAI() {
    if (this.migratedFiles.length < 3) return;

    try {
      const model = await buildModel(TASK_TYPES.ANALYSIS, { maxTokens: 600 });

      const historyText = this.migratedFiles
        .map(
          (f) =>
            `- ${f.originalPath} → ${f.className ?? "?"} (${f.type})` +
            (f.changes.length ? `\n  mudanças: ${f.changes.join("; ")}` : ""),
        )
        .join("\n");

      const result = await model.invoke([
        new SystemMessage(
          "Você é um assistente de migração Angular. Resuma decisões de migração de forma concisa.",
        ),
        new HumanMessage(
          `Resuma em até 6 linhas o progresso desta migração de AngularJS → Angular 21.\n` +
            `Destaque: nomes de classe adotados, padrões usados, estrutura de pastas emergente, e dependências entre módulos.\n\n` +
            `Arquivos migrados:\n${historyText}`,
        ),
      ]);

      let content;
      if (typeof result.content === "string") {
        content = result.content;
      } else if (Array.isArray(result.content)) {
        content = result.content.map((b) => b.text ?? "").join("");
      } else {
        content = String(result.content);
      }

      this.historySummary = content.trim();
      dbg(
        `[context] resumo IA atualizado: ${this.historySummary.length} chars`,
      );
    } catch (err) {
      dbg(`[context] falha no resumo IA, usando resumo sync: ${err.message}`);
      this._condenseHistory();
    }
  }



   
  _serializeMessages() {
    return this.messages.map((m) => {
      let role;
      if (m instanceof SystemMessage) role = "system";
      else if (m instanceof HumanMessage) role = "human";
      else role = "ai";
      const content =
        typeof m.content === "string" ? m.content : JSON.stringify(m.content);
      return { role, content };
    });
  }

   
  _deserializeMessages(serialized) {
    if (!Array.isArray(serialized)) return [];
    return serialized.map((m) => {
      if (m.role === "system") return new SystemMessage(m.content ?? "");
      if (m.role === "human") return new HumanMessage(m.content ?? "");
      return new AIMessage(m.content ?? "");
    });
  }



   
  saveCheckpoint(checkpointPath, opts = {}) {
    const data = {
      version: CHECKPOINT_VERSION,
      savedAt: new Date().toISOString(),
      projectPath: this.projectPath,
      projectName: this.projectName,
      outputDir: opts.outputDir ?? null,
      currentPhase: opts.currentPhase ?? null,
      completedFiles: this.completedFiles,
      totalFiles: this.totalFiles,
      migratedFiles: this.migratedFiles,
      symbolMap: Object.fromEntries([...this.symbolMap.entries()]),
      detectedModules: this.detectedModules,
      routes: this.routes,
      globalPatterns: [...this.globalPatterns],
      historySummary: this.historySummary,
      messageHistory: this._serializeMessages(),
      errors: opts.errors ?? [],
      stats: opts.stats ?? null,
    };

    try {
      const tmpPath = `${checkpointPath}.tmp`;
      fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
      fs.renameSync(tmpPath, checkpointPath);
      dbg(
        `[context] checkpoint salvo → ${this.completedFiles}/${this.totalFiles} arquivos | fase=${opts.currentPhase ?? "?"}`,
      );
    } catch (err) {
      dbg(`[context] falha ao salvar checkpoint: ${err.message}`);
    }
  }

   
  static loadCheckpoint(checkpointPath) {
    try {
      if (!fs.existsSync(checkpointPath)) return null;
      const raw = fs.readFileSync(checkpointPath, "utf-8");
      const data = JSON.parse(raw);
      if (data.version !== CHECKPOINT_VERSION) return null;
      return data;
    } catch {
      return null;
    }
  }

   
  restoreFromCheckpoint(checkpoint) {
    this.completedFiles = checkpoint.completedFiles ?? 0;
    this.totalFiles = checkpoint.totalFiles ?? 0;
    this.migratedFiles = checkpoint.migratedFiles ?? [];
    this.historySummary = checkpoint.historySummary ?? "";
    this.detectedModules = checkpoint.detectedModules ?? [];
    this.routes = checkpoint.routes ?? [];
    this.globalPatterns = new Set(checkpoint.globalPatterns ?? []);


    this.symbolMap = new Map();
    if (checkpoint.symbolMap && typeof checkpoint.symbolMap === "object") {
      for (const [k, v] of Object.entries(checkpoint.symbolMap)) {
        this.symbolMap.set(k, v);
      }
    }


    this.messages = this._deserializeMessages(checkpoint.messageHistory);

    dbg(
      `[context] restaurado do checkpoint: ${this.completedFiles}/${this.totalFiles} arquivos | ${this.symbolMap.size} símbolos | ${this.messages.length} mensagens LangChain`,
    );
  }



   
  getSnapshot() {
    return {
      projectName: this.projectName,
      totalFiles: this.totalFiles,
      completedFiles: this.completedFiles,
      detectedModules: this.detectedModules,
      routes: this.routes,
      symbolMap: Object.fromEntries(
        [...this.symbolMap.entries()].map(([k, v]) => [k, v]),
      ),
      migratedFiles: this.migratedFiles,
      historySummary: this.historySummary,
      messagesInHistory: this.messages.length,
    };
  }
}
