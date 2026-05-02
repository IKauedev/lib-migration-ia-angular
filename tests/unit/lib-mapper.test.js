import { describe, it, expect } from "@jest/globals";
import {
  findMapping,
  analyzePackageDependencies,
  buildLibContextForPrompt,
  detectAngularJsLibsInCode,
  LIB_MAPPINGS,
} from "../../src/utils/lib-mapper.js";

describe("lib-mapper", () => {
  describe("LIB_MAPPINGS", () => {
    it("exports a non-empty array", () => {
      expect(Array.isArray(LIB_MAPPINGS)).toBe(true);
      expect(LIB_MAPPINGS.length).toBeGreaterThan(5);
    });

    it("each mapping has required fields", () => {
      for (const m of LIB_MAPPINGS) {
        expect(m).toHaveProperty("angularjs");
        expect(m).toHaveProperty("angular");
        expect(m).toHaveProperty("action");
        expect(["replace", "drop", "manual"]).toContain(m.action);
      }
    });
  });

  describe("findMapping", () => {
    it("finds angular-ui-router", () => {
      const m = findMapping("angular-ui-router");
      expect(m).toBeDefined();
      expect(m.angular).toContain("@angular/router");
    });

    it("finds angular-resource", () => {
      const m = findMapping("angular-resource");
      expect(m).toBeDefined();
      expect(m.action).toBe("replace");
    });

    it("finds angular-mocks as drop", () => {
      const m = findMapping("angular-mocks");
      expect(m).toBeDefined();
      expect(m.action).toBe("drop");
    });

    it("returns undefined for unknown package", () => {
      const m = findMapping("some-unknown-package-xyz");
      expect(m).toBeUndefined();
    });

    it("is case-insensitive", () => {
      const m = findMapping("Angular-UI-Router");
      expect(m).toBeDefined();
    });
  });

  describe("analyzePackageDependencies", () => {
    it("separates packages to replace from packages to drop", () => {
      const pkg = {
        dependencies: {
          "angular-ui-router": "^1.0.0",
          "angular-resource": "^1.8.0",
        },
        devDependencies: {
          "angular-mocks": "^1.8.0",
          karma: "^6.0.0",
        },
      };
      const result = analyzePackageDependencies(pkg);
      expect(result.toReplace.length).toBeGreaterThan(0);
      expect(result.toDrop.length).toBeGreaterThan(0);
      // angular-ui-router should be in toReplace
      const uiRouter = result.toReplace.find(
        (r) => r.from === "angular-ui-router",
      );
      expect(uiRouter).toBeDefined();
      expect(uiRouter.to).toContain("@angular/router");
    });

    it("handles empty package.json gracefully", () => {
      const result = analyzePackageDependencies({});
      expect(result.toReplace).toHaveLength(0);
      expect(result.toDrop).toHaveLength(0);
    });
  });

  describe("buildLibContextForPrompt", () => {
    it("returns empty string when no libs detected", () => {
      expect(buildLibContextForPrompt([])).toBe("");
    });

    it("returns context string for known libs", () => {
      const ctx = buildLibContextForPrompt([
        "angular-ui-router",
        "angular-resource",
      ]);
      expect(ctx).toContain("@angular/router");
      expect(ctx).toContain("@angular/common/http");
    });

    it("skips unknown libs gracefully", () => {
      const ctx = buildLibContextForPrompt(["totally-unknown-lib"]);
      expect(typeof ctx).toBe("string");
    });
  });

  describe("detectAngularJsLibsInCode", () => {
    it("detects ui-router usage", () => {
      const libs = detectAngularJsLibsInCode("this.$state.go('home');");
      expect(libs).toContain("angular-ui-router");
    });

    it("detects $resource usage", () => {
      const libs = detectAngularJsLibsInCode(
        "const User = $resource('/api/users/:id');",
      );
      expect(libs).toContain("angular-resource");
    });

    it("detects $translate usage", () => {
      const libs = detectAngularJsLibsInCode("$translate('KEY').then(v => {})");
      expect(libs).toContain("angular-translate");
    });

    it("detects moment usage", () => {
      const libs = detectAngularJsLibsInCode(
        "const d = moment().format('YYYY');",
      );
      expect(libs).toContain("moment");
    });

    it("returns empty array for clean code", () => {
      const libs = detectAngularJsLibsInCode("export class MyService {}");
      expect(libs).toHaveLength(0);
    });
  });
});
