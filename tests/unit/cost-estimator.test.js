import { describe, it, expect } from "@jest/globals";
import {
  estimateTokens,
  findPricing,
  estimateMigrationCost,
  estimateSingleFileCost,
  formatCostEstimate,
  MODEL_PRICING,
} from "../../src/utils/cost-estimator.js";

describe("cost-estimator", () => {
  describe("MODEL_PRICING", () => {
    it("has entries for main providers", () => {
      const providers = MODEL_PRICING.map((m) => m.provider);
      expect(providers).toContain("anthropic");
      expect(providers).toContain("openai");
      expect(providers).toContain("gemini");
    });
  });

  describe("estimateTokens", () => {
    it("returns 0 for empty string", () => {
      expect(estimateTokens("")).toBe(0);
      expect(estimateTokens(null)).toBe(0);
    });

    it("estimates ~1 token per 4 chars", () => {
      const tokens = estimateTokens("a".repeat(400));
      expect(tokens).toBe(100);
    });

    it("rounds up", () => {
      const tokens = estimateTokens("abc"); // 3 chars → ceil(3/4) = 1
      expect(tokens).toBe(1);
    });
  });

  describe("findPricing", () => {
    it("finds anthropic claude-opus-4 pricing", () => {
      const p = findPricing("anthropic", "claude-opus-4");
      expect(p).toBeDefined();
      expect(p.inputPer1M).toBeGreaterThan(0);
    });

    it("finds openai gpt-4o pricing", () => {
      const p = findPricing("openai", "gpt-4o");
      expect(p).toBeDefined();
      expect(p.provider).toBe("openai");
    });

    it("returns undefined for completely unknown provider", () => {
      const p = findPricing("myai", "unknown-model-xyz");
      expect(p).toBeUndefined();
    });
  });

  describe("estimateMigrationCost", () => {
    const sampleFiles = [
      { path: "a.js", loc: 100 },
      { path: "b.js", loc: 200 },
      { path: "c.js", loc: 50 },
    ];

    it("returns structured estimate object", () => {
      const est = estimateMigrationCost(sampleFiles, "openai", "gpt-4o");
      expect(est).toHaveProperty("totalFiles");
      expect(est).toHaveProperty("inputTokens");
      expect(est).toHaveProperty("outputTokens");
      expect(est).toHaveProperty("totalTokens");
      expect(est).toHaveProperty("estimatedUSD");
      expect(est).toHaveProperty("formattedCost");
    });

    it("totalFiles matches input array length", () => {
      const est = estimateMigrationCost(sampleFiles, "openai", "gpt-4o");
      expect(est.totalFiles).toBe(3);
    });

    it("outputTokens > inputTokens (output ratio 1.4x)", () => {
      const est = estimateMigrationCost(sampleFiles, "openai", "gpt-4o");
      expect(est.outputTokens).toBeGreaterThan(est.inputTokens);
    });

    it("estimatedUSD is non-negative", () => {
      const est = estimateMigrationCost(sampleFiles, "openai", "gpt-4o");
      expect(est.estimatedUSD).toBeGreaterThanOrEqual(0);
    });

    it("returns formattedCost 'gratuito' for ollama", () => {
      const est = estimateMigrationCost(sampleFiles, "ollama", "llama3");
      expect(est.formattedCost).toContain("gratuito");
    });

    it("adds warning for very large project", () => {
      const bigFiles = Array.from({ length: 1000 }, (_, i) => ({
        path: `file${i}.js`,
        loc: 1000,
      }));
      const est = estimateMigrationCost(bigFiles, "anthropic", "claude-opus-4");
      expect(est.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("estimateSingleFileCost", () => {
    it("returns estimate for single file", () => {
      const code = "export class MyService {}\n".repeat(50);
      const est = estimateSingleFileCost(code, "openai", "gpt-4o");
      expect(est.totalFiles).toBe(1);
      expect(est.inputTokens).toBeGreaterThan(0);
    });

    it("returns zero cost for empty code", () => {
      const est = estimateSingleFileCost("", "openai", "gpt-4o");
      expect(est.inputTokens).toBeGreaterThan(0); // PROMPT_OVERHEAD still counted
    });
  });

  describe("formatCostEstimate", () => {
    it("returns array of strings", () => {
      const est = estimateMigrationCost(
        [{ path: "a.js", loc: 100 }],
        "openai",
        "gpt-4o",
      );
      const lines = formatCostEstimate(est);
      expect(Array.isArray(lines)).toBe(true);
      expect(lines.length).toBeGreaterThanOrEqual(4);
      expect(lines.every((l) => typeof l === "string")).toBe(true);
    });

    it("includes provider info", () => {
      const est = estimateMigrationCost(
        [{ path: "a.js", loc: 100 }],
        "anthropic",
        "claude-opus-4",
      );
      const text = formatCostEstimate(est).join("\n");
      expect(text).toContain("anthropic");
    });
  });
});
