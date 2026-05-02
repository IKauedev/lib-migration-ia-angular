import { describe, it, expect } from "@jest/globals";
import {
  encrypt,
  decrypt,
  isEncrypted,
  encryptConfigKeys,
  decryptConfigKeys,
} from "../../src/utils/keychain.js";

describe("keychain", () => {
  describe("encrypt / decrypt", () => {
    it("roundtrips a plaintext string", () => {
      const original = "sk-my-secret-key-1234567890";
      const enc = encrypt(original);
      expect(isEncrypted(enc)).toBe(true);
      expect(decrypt(enc)).toBe(original);
    });

    it("produces different ciphertext each call (IV randomness)", () => {
      const enc1 = encrypt("same");
      const enc2 = encrypt("same");
      expect(enc1).not.toBe(enc2);
    });

    it("roundtrips empty string", () => {
      expect(decrypt(encrypt(""))).toBe("");
    });
  });

  describe("isEncrypted", () => {
    it("returns true for enc:v1: prefixed values", () => {
      expect(isEncrypted("enc:v1:abc123")).toBe(true);
    });

    it("returns false for plain strings", () => {
      expect(isEncrypted("sk-plain-key")).toBe(false);
    });

    it("returns false for null / undefined", () => {
      expect(isEncrypted(null)).toBe(false);
      expect(isEncrypted(undefined)).toBe(false);
    });
  });

  describe("encryptConfigKeys / decryptConfigKeys", () => {
    // Note: encryptConfigKeys works on config.providers[provider].apiKey structure
    it("encrypts apiKey in providers structure", () => {
      const config = { providers: { openai: { apiKey: "sk-test" } } };
      const encrypted = encryptConfigKeys(config);
      expect(isEncrypted(encrypted.providers.openai.apiKey)).toBe(true);
    });

    it("roundtrips config providers apiKey", () => {
      const config = {
        providers: { openai: { apiKey: "sk-test", model: "gpt-4o" } },
      };
      const encrypted = encryptConfigKeys(config);
      const decrypted = decryptConfigKeys(encrypted);
      expect(decrypted.providers.openai.apiKey).toBe("sk-test");
      expect(decrypted.providers.openai.model).toBe("gpt-4o"); // unchanged
    });

    it("does not re-encrypt already-encrypted values", () => {
      const config = { providers: { openai: { apiKey: "sk-test" } } };
      const enc1 = encryptConfigKeys(config);
      const enc2 = encryptConfigKeys(enc1);
      expect(enc1.providers.openai.apiKey).toBe(enc2.providers.openai.apiKey);
    });

    it("returns config unchanged when no providers key", () => {
      const config = { model: "gpt-4o" };
      expect(encryptConfigKeys(config)).toEqual(config);
      expect(decryptConfigKeys(config)).toEqual(config);
    });
  });
});
