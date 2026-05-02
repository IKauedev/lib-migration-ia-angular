import { describe, it, expect } from "@jest/globals";
import {
  applyPostCleanup,
  detectUncleaned,
  getCleanupRules,
} from "../../src/utils/post-cleanup.js";

describe("post-cleanup", () => {
  describe("applyPostCleanup", () => {
    it("replaces angular.copy(x) with structuredClone", () => {
      const { code, applied } = applyPostCleanup(
        "const b = angular.copy(obj);",
      );
      expect(code).toContain("structuredClone");
      expect(applied.length).toBeGreaterThan(0);
    });

    it("replaces angular.extend(a, b) with Object.assign", () => {
      const { code } = applyPostCleanup("angular.extend(target, source);");
      expect(code).toContain("Object.assign");
    });

    it("replaces angular.isArray() with Array.isArray()", () => {
      const { code } = applyPostCleanup("if (angular.isArray(arr)) {}");
      expect(code).toBe("if (Array.isArray(arr)) {}");
    });

    it("replaces angular.isString(x) with typeof check", () => {
      const { code } = applyPostCleanup("angular.isString(val)");
      expect(code).toContain("typeof");
      expect(code).toContain("'string'");
    });

    it("replaces angular.noop with arrow function", () => {
      const { code } = applyPostCleanup("const fn = angular.noop;");
      expect(code).toContain("() => {}");
    });

    it("replaces $timeout( with setTimeout(", () => {
      const { code } = applyPostCleanup("$timeout(() => doSomething(), 500);");
      expect(code).toBe("setTimeout(() => doSomething(), 500);");
    });

    it("replaces $interval( with setInterval(", () => {
      const { code } = applyPostCleanup("$interval(fn, 1000);");
      expect(code).toBe("setInterval(fn, 1000);");
    });

    it("replaces $log.warn( with console.warn(", () => {
      const { code } = applyPostCleanup("$log.warn('hello');");
      expect(code).toBe("console.warn('hello');");
    });

    it("replaces $window with window", () => {
      const { code } = applyPostCleanup("const w = $window.location;");
      expect(code).toBe("const w = window.location;");
    });

    it("replaces $document[0] with document", () => {
      const { code } = applyPostCleanup("$document[0].querySelector('a')");
      expect(code).toBe("document.querySelector('a')");
    });

    it("replaces $q.resolve( with Promise.resolve(", () => {
      const { code } = applyPostCleanup("return $q.resolve(value);");
      expect(code).toBe("return Promise.resolve(value);");
    });

    it("replaces $q.all( with Promise.all(", () => {
      const { code } = applyPostCleanup("$q.all([p1, p2])");
      expect(code).toBe("Promise.all([p1, p2])");
    });

    it("replaces angular.toJson with JSON.stringify", () => {
      const { code } = applyPostCleanup("angular.toJson(data)");
      expect(code).toContain("JSON.stringify");
    });

    it("replaces angular.fromJson with JSON.parse", () => {
      const { code } = applyPostCleanup("angular.fromJson(str)");
      expect(code).toContain("JSON.parse");
    });

    it("applies multiple rules in one pass", () => {
      const input = "$log.error('fail'); $window.close();";
      const { code, totalReplacements } = applyPostCleanup(input);
      expect(code).toBe("console.error('fail'); window.close();");
      expect(totalReplacements).toBe(2);
    });

    it("returns empty applied array when no rules match", () => {
      const { code, applied, totalReplacements } = applyPostCleanup(
        "export class MyComponent {}",
      );
      expect(code).toBe("export class MyComponent {}");
      expect(applied).toHaveLength(0);
      expect(totalReplacements).toBe(0);
    });

    it("accepts extra rules via third parameter", () => {
      const extraRules = [
        {
          name: "custom",
          pattern: /MY_LEGACY/g,
          replacement: "MY_MODERN",
          description: "custom rule",
        },
      ];
      const { code } = applyPostCleanup(
        "const x = MY_LEGACY;",
        "test.ts",
        extraRules,
      );
      expect(code).toBe("const x = MY_MODERN;");
    });
  });

  describe("detectUncleaned", () => {
    it("detects $scope residuals", () => {
      const leftovers = detectUncleaned("$scope.value = 1;");
      expect(leftovers).toContain("$scope");
    });

    it("detects angular.module() residuals", () => {
      const leftovers = detectUncleaned("angular.module('app', [])");
      expect(leftovers).toContain("angular.module()");
    });

    it("detects ng-repeat in templates", () => {
      const leftovers = detectUncleaned('<li ng-repeat="item in items">');
      expect(leftovers).toContain("ng-repeat");
    });

    it("returns empty array for clean code", () => {
      const leftovers = detectUncleaned(
        "export class MyComponent { title = signal(''); }",
      );
      expect(leftovers).toHaveLength(0);
    });
  });

  describe("getCleanupRules", () => {
    it("returns non-empty array of rules", () => {
      const rules = getCleanupRules();
      expect(Array.isArray(rules)).toBe(true);
      expect(rules.length).toBeGreaterThan(10);
    });

    it("each rule has name, pattern, replacement", () => {
      const rules = getCleanupRules();
      for (const rule of rules) {
        expect(rule).toHaveProperty("name");
        expect(rule).toHaveProperty("pattern");
        expect(rule).toHaveProperty("replacement");
      }
    });
  });
});
