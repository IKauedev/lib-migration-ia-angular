import { describe, it, expect } from "@jest/globals";
import {
  needsChunking,
  splitIntoChunks,
  mergeChunkResults,
  buildChunkContext,
} from "../../src/utils/chunk-migrator.js";

const LARGE_CODE = "// line\n".repeat(6000); // ~48000 chars, above 40000 threshold

describe("chunk-migrator", () => {
  describe("needsChunking", () => {
    it("returns false for small code", () => {
      expect(needsChunking("const x = 1;")).toBe(false);
    });

    it("returns true for code larger than threshold", () => {
      expect(needsChunking(LARGE_CODE)).toBe(true);
    });
  });

  describe("splitIntoChunks", () => {
    it("splits large code into multiple chunks", () => {
      const chunks = splitIntoChunks(LARGE_CODE);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it("each chunk has content and index", () => {
      const chunks = splitIntoChunks(LARGE_CODE);
      chunks.forEach((c, i) => {
        expect(c).toHaveProperty("content");
        expect(c).toHaveProperty("index");
        expect(c.index).toBe(i);
      });
    });

    it("does not split small code (returns single chunk)", () => {
      const small = "const x = 1;";
      const chunks = splitIntoChunks(small);
      expect(chunks.length).toBe(1);
      expect(chunks[0].content).toBe(small);
    });
  });

  describe("mergeChunkResults", () => {
    it("merges multiple results into one", () => {
      const results = [
        {
          codigoMigrado:
            "import { A } from '@angular/core';\nexport class A {}",
        },
        {
          codigoMigrado:
            "import { A } from '@angular/core';\nexport class B {}",
        },
      ];
      const merged = mergeChunkResults(results);
      expect(merged.codigoMigrado).toContain("class A");
      expect(merged.codigoMigrado).toContain("class B");
    });

    it("deduplicates identical imports", () => {
      const results = [
        {
          codigoMigrado:
            "import { Component } from '@angular/core';\nclass A {}",
        },
        {
          codigoMigrado:
            "import { Component } from '@angular/core';\nclass B {}",
        },
      ];
      const merged = mergeChunkResults(results);
      const importCount = (
        merged.codigoMigrado.match(/import { Component }/g) || []
      ).length;
      expect(importCount).toBe(1);
    });

    it("handles single result", () => {
      const result = { codigoMigrado: "export class X {}" };
      const merged = mergeChunkResults([result]);
      expect(merged.codigoMigrado).toContain("class X");
    });
  });

  describe("buildChunkContext", () => {
    it("returns a descriptive string", () => {
      const chunk = { index: 1, content: "class A {}" };
      const ctx = buildChunkContext(chunk, 3, {
        path: "app.ts",
        type: "component",
      });
      expect(typeof ctx).toBe("string");
      expect(ctx.length).toBeGreaterThan(0);
    });
  });
});
