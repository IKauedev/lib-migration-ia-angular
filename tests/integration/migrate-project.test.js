import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_DIR = path.join(__dirname, "../fixtures/angularjs-project");

/**
 * Integration tests for migrate-project command.
 * AI calls are mocked to avoid real API usage.
 */
describe("migrate-project integration", () => {
  let outputDir;

  beforeEach(() => {
    outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "ng-migrate-test-"));
  });

  afterEach(() => {
    fs.rmSync(outputDir, { recursive: true, force: true });
  });

  it("fixture project files exist and are readable", () => {
    const serviceFile = path.join(FIXTURE_DIR, "user.service.js");
    expect(fs.existsSync(serviceFile)).toBe(true);
    const content = fs.readFileSync(serviceFile, "utf-8");
    expect(content).toContain("angular.module");
  });

  it("controller fixture has $scope usage", () => {
    const ctrl = fs.readFileSync(
      path.join(FIXTURE_DIR, "user.controller.js"),
      "utf-8",
    );
    expect(ctrl).toContain("$scope");
    expect(ctrl).toContain("$http");
  });

  it("filter fixture has angular filter definition", () => {
    const filter = fs.readFileSync(
      path.join(FIXTURE_DIR, "capitalize.filter.js"),
      "utf-8",
    );
    expect(filter).toContain(".filter(");
  });

  describe("utility chain integration", () => {
    it("chunk-migrator + parser roundtrip", async () => {
      const { needsChunking, splitIntoChunks, mergeChunkResults } =
        await import("../../src/utils/chunk-migrator.js");
      const { parseMigrateResponse } =
        await import("../../src/utils/parser.js");

      const code = fs.readFileSync(
        path.join(FIXTURE_DIR, "user.service.js"),
        "utf-8",
      );

      // Simulate what migrate-project does for a small file
      const shouldChunk = needsChunking(code);
      expect(shouldChunk).toBe(false); // fixture is small

      // Simulate a migrated result
      const fakeResult = parseMigrateResponse({
        codigoMigrado: `import { Injectable } from '@angular/core';\nimport { HttpClient } from '@angular/common/http';\n\n@Injectable({ providedIn: 'root' })\nexport class UserService {\n  constructor(private http: HttpClient) {}\n}`,
        tipo: "service",
        nomeClasse: "UserService",
      });

      expect(fakeResult.tipo).toBe("service");
      expect(fakeResult.codigoMigrado).toContain("@Injectable");
    });

    it("symbol-checker detects no collisions in single fixture", async () => {
      const { detectSymbolCollisions } =
        await import("../../src/utils/symbol-checker.js");

      const registry = {
        symbols: {
          userService: { angularName: "UserService", file: "user.service.ts" },
          userController: {
            angularName: "UserComponent",
            file: "user.component.ts",
          },
          capitalizeFilter: {
            angularName: "CapitalizePipe",
            file: "capitalize.pipe.ts",
          },
        },
      };

      const result = detectSymbolCollisions(registry);
      expect(result.hasCollisions).toBe(false);
    });

    it("rollback manager works with real temp files", async () => {
      const { RollbackManager, atomicWrite } =
        await import("../../src/utils/rollback.js");

      const rollback = new RollbackManager();
      rollback.beginPhase(1);

      const file = path.join(outputDir, "test-output.ts");
      atomicWrite(file, "export class TestService {}", rollback);

      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, "utf-8")).toBe(
        "export class TestService {}",
      );

      rollback.commitPhase(1);
      const stats = rollback.stats();
      // After commit, phase is removed from active tracking
      expect(stats).toBeDefined();
      expect(stats.total).toBeGreaterThanOrEqual(1);
    });
  });
});
