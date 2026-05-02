import { describe, it, expect } from "@jest/globals";
import {
  buildReport,
  computeQualityScore,
  detectResidualPatterns,
} from "../../src/utils/report.js";

describe("report", () => {
  describe("computeQualityScore", () => {
    it("returns 100 for perfect migration", () => {
      const stats = { total: 10, success: 10, errors: 0, skipped: 0 };
      const score = computeQualityScore(stats, 0, 0);
      expect(score).toBe(100);
    });

    it("returns lower score when there are errors", () => {
      const stats = { total: 10, success: 7, errors: 3, skipped: 0 };
      const score = computeQualityScore(stats, 0, 0);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("returns lower score for TypeScript errors", () => {
      const stats = { total: 10, success: 10, errors: 0, skipped: 0 };
      const scoreClean = computeQualityScore(stats, 0, 0);
      const scoreWithTsErrors = computeQualityScore(stats, 5, 0);
      expect(scoreWithTsErrors).toBeLessThan(scoreClean);
    });

    it("returns lower score for residual patterns", () => {
      const stats = { total: 10, success: 10, errors: 0, skipped: 0 };
      const scoreClean = computeQualityScore(stats, 0, 0);
      const scoreWithResiduals = computeQualityScore(stats, 0, 5);
      expect(scoreWithResiduals).toBeLessThan(scoreClean);
    });

    it("clamps score to 0-100 range", () => {
      const stats = { total: 10, success: 0, errors: 10, skipped: 0 };
      const score = computeQualityScore(stats, 100, 100);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe("detectResidualPatterns", () => {
    it("detects $scope usage", () => {
      const files = [{ path: "app.ts", code: "$scope.name = 'test';" }];
      const patterns = detectResidualPatterns(files);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it("detects angular.module usage", () => {
      const files = [{ path: "app.ts", code: "angular.module('app', []);" }];
      const patterns = detectResidualPatterns(files);
      expect(patterns.length).toBeGreaterThan(0);
    });

    it("returns empty for clean Angular code", () => {
      const files = [
        {
          path: "app.ts",
          code: "import { Component } from '@angular/core';\n@Component({}) export class AppComponent {}",
        },
      ];
      const patterns = detectResidualPatterns(files);
      expect(patterns.length).toBe(0);
    });

    it("handles empty file list", () => {
      expect(detectResidualPatterns([])).toEqual([]);
    });
  });

  describe("buildReport", () => {
    it("generates a non-empty report string", () => {
      const report = buildReport({
        repoName: "test-app",
        provider: "openai",
        branch: "main",
        stats: { total: 5, success: 4, errors: 1, skipped: 0, files: [] },
        depReport: null,
        errors: [{ file: "broken.js", message: "timeout" }],
        outputDir: "/tmp/test-angular21",
        qualityReport: null,
      });
      expect(typeof report).toBe("string");
      expect(report.length).toBeGreaterThan(100);
      expect(report).toContain("test-app");
    });

    it("includes quality score when qualityReport is provided", () => {
      const report = buildReport({
        repoName: "my-app",
        provider: "anthropic",
        branch: "main",
        stats: { total: 3, success: 3, errors: 0, skipped: 0, files: [] },
        depReport: null,
        errors: [],
        outputDir: "/tmp/my-angular21",
        qualityReport: {
          overallScore: 95,
          residualPatterns: [],
          tsErrors: [],
          chunkedFiles: [],
        },
      });
      expect(report).toContain("95");
    });
  });
});
