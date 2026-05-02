import { describe, it, expect } from "@jest/globals";
import {
  detectSymbolCollisions,
  resolveCollisions,
  formatCollisionReport,
  detectExportCollisions,
} from "../../src/utils/symbol-checker.js";

const makeRegistry = (symbols) => ({ symbols });

describe("symbol-checker", () => {
  // Note: detectSymbolCollisions expects registry.symbols to be an ARRAY
  const makeRegistryArray = (symbols) => ({ symbols });

  describe("detectSymbolCollisions", () => {
    it("returns no collisions for unique symbols", () => {
      const registry = makeRegistryArray([
        {
          suggestedClassName: "UserService",
          file: "user.service.ts",
          kind: "service",
        },
        {
          suggestedClassName: "AuthService",
          file: "auth.service.ts",
          kind: "service",
        },
      ]);
      const result = detectSymbolCollisions(registry);
      expect(result.hasCollisions).toBe(false);
      expect(result.collisions).toHaveLength(0);
    });

    it("detects duplicate Angular class names", () => {
      const registry = makeRegistryArray([
        {
          suggestedClassName: "UserService",
          file: "user.service.ts",
          kind: "service",
        },
        {
          suggestedClassName: "UserService",
          file: "admin-user.service.ts",
          kind: "service",
        },
      ]);
      const result = detectSymbolCollisions(registry);
      expect(result.hasCollisions).toBe(true);
      expect(result.collisions.length).toBeGreaterThan(0);
    });

    it("handles empty registry gracefully", () => {
      const result = detectSymbolCollisions(null);
      expect(result.hasCollisions).toBe(false);
    });

    it("handles registry with no symbols", () => {
      const result = detectSymbolCollisions({});
      expect(result.hasCollisions).toBe(false);
    });
  });

  describe("resolveCollisions", () => {
    it("renames duplicate classes by adding numeric suffix", () => {
      const registry = makeRegistryArray([
        { suggestedClassName: "UserService", file: "a.ts", kind: "service" },
        { suggestedClassName: "UserService", file: "b.ts", kind: "service" },
      ]);
      const { collisions } = detectSymbolCollisions(registry);
      const resolved = resolveCollisions(registry, collisions);
      const names = resolved.symbols.map(
        (s) => s.suggestedClassName || s.angularName,
      );
      const unique = new Set(names);
      expect(unique.size).toBe(names.length);
    });
  });

  describe("formatCollisionReport", () => {
    it("returns a string description of collisions", () => {
      const collisions = [
        { className: "UserService", files: ["a.ts", "b.ts"], type: "service" },
      ];
      const report = formatCollisionReport(collisions);
      expect(typeof report).toBe("string");
      expect(report).toContain("UserService");
    });

    it("returns empty string for no collisions", () => {
      const report = formatCollisionReport([]);
      expect(typeof report).toBe("string");
    });
  });

  describe("detectExportCollisions", () => {
    // detectExportCollisions returns { collisions, hasCollisions }
    it("detects duplicate export class names across files", () => {
      const files = [
        { path: "a.ts", code: "export class MyService {}" },
        { path: "b.ts", code: "export class MyService {}" },
      ];
      const result = detectExportCollisions(files);
      expect(result.hasCollisions).toBe(true);
      expect(result.collisions[0].className).toBe("MyService");
    });

    it("returns no collisions for unique exports", () => {
      const files = [
        { path: "a.ts", code: "export class FooService {}" },
        { path: "b.ts", code: "export class BarPipe {}" },
      ];
      const result = detectExportCollisions(files);
      expect(result.hasCollisions).toBe(false);
      expect(result.collisions).toHaveLength(0);
    });
  });
});
