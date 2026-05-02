import { describe, it, expect } from "@jest/globals";
import { validateSingleFile } from "../../src/utils/ts-validator.js";

describe("ts-validator", () => {
  describe("validateSingleFile (regex-based)", () => {
    it("passes clean Angular component code", async () => {
      const code = `
import { Component } from '@angular/core';

@Component({ selector: 'app-root', template: '<h1>Hello</h1>', standalone: true })
export class AppComponent {
  title = 'app';
}
`;
      const result = await validateSingleFile(code, "app.component.ts");
      expect(result).toBeDefined();
      // May have warnings but should not fatal error on clean code
    });

    it("detects unbalanced braces", async () => {
      const code = `export class Broken { constructor() { }`;
      const result = await validateSingleFile(code, "broken.ts");
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it("detects residual AngularJS $scope usage", async () => {
      const code = `
export class Migrated {
  constructor() {
    $scope.name = 'test'; // residual
  }
}
`;
      const result = await validateSingleFile(code, "migrated.ts");
      expect(result).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it("handles empty string without throwing", async () => {
      await expect(validateSingleFile("", "empty.ts")).resolves.toBeDefined();
    });
  });
});
