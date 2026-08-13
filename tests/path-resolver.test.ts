import { describe, it, expect } from "vitest";
import path from "path";
import { resolveOutputPath } from "../src/utils/path-resolver.js";

describe("resolveOutputPath", () => {
  it("prefixes simple filename with output/ directory", () => {
    const input = "report.xlsx";
    const resolved = resolveOutputPath(input);
    expect(resolved).toBe(path.join("output", "report.xlsx"));
  });

  it("retains path if already prefixed with output/", () => {
    const input = path.join("output", "report.xlsx");
    const resolved = resolveOutputPath(input);
    expect(resolved).toBe(input);
  });

  it("retains absolute path", () => {
    const absPath = path.resolve("custom_folder", "report.xlsx");
    const resolved = resolveOutputPath(absPath);
    expect(resolved).toBe(absPath);
  });
});
