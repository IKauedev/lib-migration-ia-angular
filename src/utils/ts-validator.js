/**
 * ts-validator.js
 * Valida código TypeScript gerado após migração usando tsc --noEmit.
 * Fallback: verificação de sintaxe básica via regex.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { dbg } from "./debug.js";

const execFileAsync = promisify(execFile);

/** Resultado de validação */
export class ValidationResult {
  constructor({ valid, errors = [], warnings = [], source = "tsc" }) {
    this.valid = valid;
    this.errors = errors; // [{ file, line, col, message }]
    this.warnings = warnings; // [{ file, line, col, message }]
    this.source = source; // 'tsc' | 'syntax'
  }
}

/**
 * Verifica se o TypeScript CLI está disponível no PATH.
 */
export async function isTscAvailable() {
  try {
    const cmd = process.platform === "win32" ? "tsc.cmd" : "tsc";
    await execFileAsync(cmd, ["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Valida um diretório inteiro com `tsc --noEmit`.
 * @param {string} projectDir - Pasta do projeto Angular scaffolded
 * @returns {Promise<ValidationResult>}
 */
export async function validateTypeScriptProject(projectDir) {
  if (!fs.existsSync(projectDir)) {
    return new ValidationResult({
      valid: false,
      errors: [
        { file: projectDir, line: 0, col: 0, message: "Pasta não encontrada" },
      ],
      source: "tsc",
    });
  }

  const tsconfigPath = path.join(projectDir, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) {
    dbg("[ts-validator] tsconfig.json não encontrado — pulando validação tsc");
    return new ValidationResult({
      valid: true,
      source: "tsc",
      warnings: [
        { message: "tsconfig.json não encontrado — validação pulada" },
      ],
    });
  }

  const available = await isTscAvailable();
  if (!available) {
    dbg(
      "[ts-validator] tsc não disponível — usando verificação de sintaxe básica",
    );
    return validateSyntaxBasic(projectDir);
  }

  try {
    const cmd = process.platform === "win32" ? "tsc.cmd" : "tsc";
    await execFileAsync(cmd, ["--noEmit", "--project", tsconfigPath], {
      cwd: projectDir,
    });
    dbg("[ts-validator] compilação TypeScript sem erros");
    return new ValidationResult({ valid: true, source: "tsc" });
  } catch (err) {
    const output = err.stdout || err.stderr || err.message || "";
    const errors = parseTscOutput(output);
    dbg(`[ts-validator] ${errors.length} erro(s) de compilação detectados`);
    return new ValidationResult({
      valid: errors.length === 0,
      errors,
      source: "tsc",
    });
  }
}

/**
 * Valida um único arquivo TypeScript escrevendo em temp e compilando.
 * @param {string} code - Conteúdo TypeScript a validar
 * @param {string} filename - Nome lógico do arquivo (para mensagens de erro)
 * @returns {Promise<ValidationResult>}
 */
export async function validateSingleFile(code, filename = "migrated.ts") {
  const available = await isTscAvailable();
  if (!available) {
    return validateSingleFileSyntax(code, filename);
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ng-migrate-tsc-"));
  const tmpFile = path.join(
    tmpDir,
    filename.endsWith(".ts") ? filename : filename + ".ts",
  );
  const tmpTsconfig = path.join(tmpDir, "tsconfig.json");

  try {
    fs.writeFileSync(tmpFile, code, "utf-8");
    fs.writeFileSync(
      tmpTsconfig,
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ES2022",
            moduleResolution: "bundler",
            strict: false,
            noEmit: true,
            skipLibCheck: true,
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
          },
        },
        null,
        2,
      ),
    );

    const cmd = process.platform === "win32" ? "tsc.cmd" : "tsc";
    await execFileAsync(cmd, ["--noEmit", "--project", tmpTsconfig]);
    return new ValidationResult({ valid: true, source: "tsc" });
  } catch (err) {
    const output = err.stdout || err.stderr || err.message || "";
    const errors = parseTscOutput(output).map((e) => ({
      ...e,
      file: filename,
    }));
    return new ValidationResult({
      valid: errors.length === 0,
      errors,
      source: "tsc",
    });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true });
    } catch {
      /* ignore */
    }
  }
}

/**
 * Analisa a saída do tsc e retorna array de erros estruturados.
 */
function parseTscOutput(output) {
  const errors = [];
  const lines = output.split("\n");
  // tsc format: file(line,col): error TS1234: message
  const errorRegex =
    /^(.*?)\((\d+),(\d+)\):\s+(error|warning)\s+TS\d+:\s+(.+)$/;
  for (const line of lines) {
    const m = line.match(errorRegex);
    if (m) {
      errors.push({
        file: m[1].trim(),
        line: parseInt(m[2], 10),
        col: parseInt(m[3], 10),
        severity: m[4],
        message: m[5].trim(),
      });
    }
  }
  return errors;
}

/**
 * Verificação de sintaxe básica via regex (sem tsc).
 */
function validateSingleFileSyntax(code, filename) {
  const errors = [];

  // Chaves não balanceadas
  const opens = (code.match(/\{/g) || []).length;
  const closes = (code.match(/\}/g) || []).length;
  if (opens !== closes) {
    errors.push({
      file: filename,
      line: 0,
      col: 0,
      message: `Chaves não balanceadas: ${opens} abertas, ${closes} fechadas`,
    });
  }

  // Parênteses não balanceados
  const parOpen = (code.match(/\(/g) || []).length;
  const parClose = (code.match(/\)/g) || []).length;
  if (parOpen !== parClose) {
    errors.push({
      file: filename,
      line: 0,
      col: 0,
      message: `Parênteses não balanceados: ${parOpen} abertos, ${parClose} fechados`,
    });
  }

  // @Component sem selector
  if (
    code.includes("@Component") &&
    !code.match(/@Component\s*\(\s*\{[\s\S]*?selector\s*:/)
  ) {
    errors.push({
      file: filename,
      line: 0,
      col: 0,
      message: "@Component sem propriedade selector definida",
    });
  }

  // Importações AngularJS residuais
  if (
    code.match(/angular\.module|angular\.controller|\$scope\s*,|\$http\s*,/)
  ) {
    errors.push({
      file: filename,
      line: 0,
      col: 0,
      message: "Padrões AngularJS residuais detectados no código migrado",
    });
  }

  return new ValidationResult({
    valid: errors.length === 0,
    errors,
    source: "syntax",
  });
}

function validateSyntaxBasic(projectDir) {
  const tsFiles = [];
  _collectTsFiles(projectDir, tsFiles);
  const errors = [];
  for (const f of tsFiles) {
    try {
      const code = fs.readFileSync(f, "utf-8");
      const result = validateSingleFileSyntax(
        code,
        path.relative(projectDir, f),
      );
      errors.push(...result.errors);
    } catch {
      /* ignore */
    }
  }
  return new ValidationResult({
    valid: errors.length === 0,
    errors,
    source: "syntax",
  });
}

function _collectTsFiles(dir, result) {
  const skip = ["node_modules", ".angular", "dist"];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (skip.includes(entry.name)) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) _collectTsFiles(full, result);
      else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".spec.ts"))
        result.push(full);
    }
  } catch {
    /* ignore */
  }
}
