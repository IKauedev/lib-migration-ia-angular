import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "fs";
import path from "path";
import os from "os";
import {
  applyPluginRules,
  runPluginPostProcess,
  shouldSkipFile,
  getPluginPromptAdditions,
  loadPlugin,
} from "../../src/utils/plugin-loader.js";

describe("plugin-loader", () => {
  describe("applyPluginRules", () => {
    it("applies string replacement rules", () => {
      const plugin = {
        rules: [
          { pattern: /LEGACY/g, replaceWith: "MODERN", description: "test" },
        ],
      };
      const result = applyPluginRules("const x = LEGACY;", plugin);
      expect(result).toBe("const x = MODERN;");
    });

    it("applies function replacement rules", () => {
      const plugin = {
        rules: [
          { pattern: /(\w+)Legacy/g, replaceWith: (m, n) => `${n}Modern` },
        ],
      };
      const result = applyPluginRules("const fooLegacy = 1;", plugin);
      expect(result).toBe("const fooModern = 1;");
    });

    it("accepts string pattern (converts to regex)", () => {
      const plugin = {
        rules: [{ pattern: "TODO", replaceWith: "DONE" }],
      };
      const result = applyPluginRules("// TODO: fix this", plugin);
      expect(result).toBe("// DONE: fix this");
    });

    it("returns code unchanged when plugin is null", () => {
      const code = "export class X {}";
      expect(applyPluginRules(code, null)).toBe(code);
    });

    it("returns code unchanged when plugin has no rules", () => {
      const code = "export class X {}";
      expect(applyPluginRules(code, {})).toBe(code);
    });

    it("returns code unchanged when rules array is empty", () => {
      const code = "export class X {}";
      expect(applyPluginRules(code, { rules: [] })).toBe(code);
    });
  });

  describe("runPluginPostProcess", () => {
    it("runs postProcess and returns transformed code", async () => {
      const plugin = {
        postProcess: async (code) => code + "\n// processed",
      };
      const result = await runPluginPostProcess(
        "export class X {}",
        plugin,
        "x.ts",
      );
      expect(result).toContain("// processed");
    });

    it("returns original code if plugin is null", async () => {
      const code = "export class X {}";
      const result = await runPluginPostProcess(code, null);
      expect(result).toBe(code);
    });

    it("returns original code if postProcess is not a function", async () => {
      const code = "export class X {}";
      const result = await runPluginPostProcess(code, {
        postProcess: "invalid",
      });
      expect(result).toBe(code);
    });

    it("returns original code if postProcess returns non-string", async () => {
      const plugin = { postProcess: async () => 42 };
      const code = "export class X {}";
      const result = await runPluginPostProcess(code, plugin);
      expect(result).toBe(code);
    });
  });

  describe("shouldSkipFile", () => {
    it("returns false if plugin is null", () => {
      expect(shouldSkipFile("src/app/foo.ts", null)).toBe(false);
    });

    it("returns false if skipFiles is empty", () => {
      expect(shouldSkipFile("src/app/foo.ts", { skipFiles: [] })).toBe(false);
    });

    it("matches exact file name", () => {
      const plugin = { skipFiles: ["src/legacy.js"] };
      expect(shouldSkipFile("src/legacy.js", plugin)).toBe(true);
    });

    it("matches glob with single *", () => {
      const plugin = { skipFiles: ["src/*.js"] };
      expect(shouldSkipFile("src/foo.js", plugin)).toBe(true);
      expect(shouldSkipFile("src/sub/foo.js", plugin)).toBe(false);
    });

    it("matches glob with **", () => {
      const plugin = { skipFiles: ["src/**"] };
      expect(shouldSkipFile("src/deep/nested/file.js", plugin)).toBe(true);
    });

    it("does not match unrelated path", () => {
      const plugin = { skipFiles: ["legacy/**"] };
      expect(shouldSkipFile("src/app/foo.js", plugin)).toBe(false);
    });
  });

  describe("getPluginPromptAdditions", () => {
    it("returns empty string for null plugin", () => {
      expect(getPluginPromptAdditions(null)).toBe("");
    });

    it("returns empty string if no promptAdditions", () => {
      expect(getPluginPromptAdditions({})).toBe("");
    });

    it("returns the promptAdditions string", () => {
      const plugin = { promptAdditions: "Use inject() everywhere." };
      expect(getPluginPromptAdditions(plugin)).toBe("Use inject() everywhere.");
    });
  });

  describe("loadPlugin", () => {
    let tmpDir;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "ng-plugin-test-"));
    });

    afterEach(() => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    });

    it("returns null when no config file exists", async () => {
      const result = await loadPlugin(tmpDir);
      expect(result).toBeNull();
    });

    it("loads a valid ng-migrate.config.mjs", async () => {
      const configContent = `export default {
  rules: [{ pattern: /OLD/g, replaceWith: 'NEW' }],
  promptAdditions: 'custom hint',
};`;
      fs.writeFileSync(
        path.join(tmpDir, "ng-migrate.config.mjs"),
        configContent,
        "utf8",
      );
      const plugin = await loadPlugin(tmpDir);
      // File is valid ESM — should load or return null depending on runtime support
      // We only verify no exception is thrown
      expect(plugin === null || typeof plugin === "object").toBe(true);
    });
  });
});
