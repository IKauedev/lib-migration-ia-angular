/**
 * keychain.js
 * Armazenamento seguro de API keys usando AES-256-GCM com chave derivada
 * do identificador do sistema (sem dependências nativas externas).
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { dbg } from "./debug.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // GCM recommends 96-bit IV
const TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256-bit
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = "sha256";

/** Marcador que indica que o valor está criptografado */
const ENCRYPTED_PREFIX = "enc:v1:";

/**
 * Gera uma chave de cifra derivada de um identificador de máquina.
 * @param {Buffer} salt
 * @returns {Buffer}
 */
function deriveKey(salt) {
  // Machine-specific seed: username + hostname + homedir path
  const machineId = [os.userInfo().username, os.hostname(), os.homedir()].join(
    "|",
  );
  return crypto.pbkdf2Sync(
    machineId,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST,
  );
}

/**
 * Cifra um valor com AES-256-GCM.
 * @param {string} plaintext
 * @returns {string} Formato: "enc:v1:<base64(salt+iv+tag+ciphertext)>"
 */
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  if (plaintext.startsWith(ENCRYPTED_PREFIX)) return plaintext; // already encrypted

  const salt = crypto.randomBytes(SALT_LENGTH);
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(salt);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([salt, iv, tag, encrypted]);
  return ENCRYPTED_PREFIX + combined.toString("base64");
}

/**
 * Decifra um valor cifrado por `encrypt()`.
 * @param {string} ciphertext
 * @returns {string} Valor original, ou o valor original se não estiver cifrado
 */
export function decrypt(ciphertext) {
  if (!ciphertext) return ciphertext;
  if (!ciphertext.startsWith(ENCRYPTED_PREFIX)) return ciphertext; // not encrypted

  try {
    const combined = Buffer.from(
      ciphertext.slice(ENCRYPTED_PREFIX.length),
      "base64",
    );

    let offset = 0;
    const salt = combined.slice(offset, offset + SALT_LENGTH);
    offset += SALT_LENGTH;
    const iv = combined.slice(offset, offset + IV_LENGTH);
    offset += IV_LENGTH;
    const tag = combined.slice(offset, offset + TAG_LENGTH);
    offset += TAG_LENGTH;
    const encrypted = combined.slice(offset);

    const key = deriveKey(salt);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);

    return decipher.update(encrypted) + decipher.final("utf8");
  } catch (err) {
    dbg(`[keychain] falha ao decifrar: ${err.message}`);
    return ciphertext; // return as-is (may be old plaintext)
  }
}

/**
 * Verifica se um valor está criptografado.
 * @param {string} value
 * @returns {boolean}
 */
export function isEncrypted(value) {
  return typeof value === "string" && value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Cifra todas as API keys em um objeto de configuração de providers.
 * @param {Object} config - Objeto de configuração do ng-migrate
 * @returns {Object} Config com keys criptografadas
 */
export function encryptConfigKeys(config) {
  if (!config?.providers) return config;

  const encrypted = JSON.parse(JSON.stringify(config));
  for (const [provider, settings] of Object.entries(
    encrypted.providers || {},
  )) {
    if (settings?.apiKey && !isEncrypted(settings.apiKey)) {
      encrypted.providers[provider].apiKey = encrypt(settings.apiKey);
      dbg(`[keychain] API key criptografada para provider: ${provider}`);
    }
  }
  return encrypted;
}

/**
 * Decifra todas as API keys em um objeto de configuração de providers.
 * @param {Object} config
 * @returns {Object} Config com keys decifradas (em memória)
 */
export function decryptConfigKeys(config) {
  if (!config?.providers) return config;

  const decrypted = JSON.parse(JSON.stringify(config));
  for (const [provider, settings] of Object.entries(
    decrypted.providers || {},
  )) {
    if (settings?.apiKey && isEncrypted(settings.apiKey)) {
      decrypted.providers[provider].apiKey = decrypt(settings.apiKey);
    }
  }
  return decrypted;
}
