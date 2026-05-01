import fs from "fs";
import path from "path";
import os from "os";

const ENV_FILE = path.join(os.homedir(), ".ng-migrate", ".env");

export function loadEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return;

  let raw;
  try {
    raw = fs.readFileSync(ENV_FILE, "utf-8");
  } catch {
    return;
  }

  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;

    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed
      .slice(eqIdx + 1)
      .trim()
      .replace(/^["']|["']$/g, ""); // strip quotes

    if (!key) continue;

    if (process.env[key] === undefined) {
      process.env[key] = val;
    }
  }
}

export function readEnvFile() {
  if (!fs.existsSync(ENV_FILE)) return {};

  const result = {};
  try {
    const raw = fs.readFileSync(ENV_FILE, "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed
        .slice(eqIdx + 1)
        .trim()
        .replace(/^["']|["']$/g, "");
      if (key) result[key] = val;
    }
  } catch {}

  return result;
}

export function writeEnvFile(vars) {
  const dir = path.dirname(ENV_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const lines = [
    "# ng-migrate-angularjs-ai — variáveis de ambiente",
    "# Gerado automaticamente. Edite com: ng-migrate env set KEY VALUE",
    "",
    ...Object.entries(vars).map(([k, v]) => `${k}=${v}`),
    "",
  ];

  fs.writeFileSync(ENV_FILE, lines.join("\n"), "utf-8");
}

export const ENV_FILE_PATH = ENV_FILE;
