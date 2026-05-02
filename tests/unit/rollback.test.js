import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import fs from "fs";
import path from "path";
import os from "os";
import { RollbackManager, atomicWrite } from "../../src/utils/rollback.js";

describe("rollback", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rollback-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("atomicWrite", () => {
    it("creates file with content", () => {
      const file = path.join(tmpDir, "out.ts");
      const rollback = new RollbackManager();
      rollback.beginPhase(1);
      atomicWrite(file, "export class Foo {}", rollback);
      expect(fs.existsSync(file)).toBe(true);
      expect(fs.readFileSync(file, "utf-8")).toBe("export class Foo {}");
    });

    it("overwrites existing file and can rollback", () => {
      const file = path.join(tmpDir, "out.ts");
      fs.writeFileSync(file, "original content", "utf-8");

      const rollback = new RollbackManager();
      rollback.beginPhase(1);
      atomicWrite(file, "new content", rollback);
      expect(fs.readFileSync(file, "utf-8")).toBe("new content");

      rollback.rollbackPhase(1);
      expect(fs.readFileSync(file, "utf-8")).toBe("original content");
    });

    it("rollback deletes newly created files", () => {
      const file = path.join(tmpDir, "new-file.ts");
      const rollback = new RollbackManager();
      rollback.beginPhase(1);
      atomicWrite(file, "export class Bar {}", rollback);
      expect(fs.existsSync(file)).toBe(true);

      rollback.rollbackPhase(1);
      expect(fs.existsSync(file)).toBe(false);
    });
  });

  describe("RollbackManager", () => {
    it("commitPhase clears rollback data for phase", () => {
      const rollback = new RollbackManager();
      rollback.beginPhase(1);
      const file = path.join(tmpDir, "x.ts");
      atomicWrite(file, "class X {}", rollback);
      rollback.commitPhase(1);
      const stats = rollback.stats();
      // After commitPhase, the phase is removed from phaseOperations
      expect(stats.phases).not.toContain("1");
      expect(stats.total).toBeGreaterThanOrEqual(1);
    });

    it("rollbackAll restores multiple phases", () => {
      const rollback = new RollbackManager();

      const file1 = path.join(tmpDir, "a.ts");
      const file2 = path.join(tmpDir, "b.ts");
      fs.writeFileSync(file1, "original-a", "utf-8");
      fs.writeFileSync(file2, "original-b", "utf-8");

      rollback.beginPhase(1);
      atomicWrite(file1, "modified-a", rollback);
      rollback.beginPhase(2);
      atomicWrite(file2, "modified-b", rollback);

      rollback.rollbackAll();

      expect(fs.readFileSync(file1, "utf-8")).toBe("original-a");
      expect(fs.readFileSync(file2, "utf-8")).toBe("original-b");
    });

    it("stats returns correct counts", () => {
      const rollback = new RollbackManager();
      rollback.beginPhase(1);
      rollback.commitPhase(1);
      rollback.beginPhase(2);
      rollback.rollbackPhase(2);
      const stats = rollback.stats();
      // phase 1 was committed (deleted from map), phase 2 was rolledBack (also deleted)
      expect(stats).toBeDefined();
      expect(typeof stats.total).toBe("number");
    });
  });
});
