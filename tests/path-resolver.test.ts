import { describe, it, expect } from "vitest";
import path from "path";
import { resolveOutputPath, formatPrefixedOutputPath } from "../src/utils/path-resolver.js";

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

describe("formatPrefixedOutputPath", () => {
  it("prefixes filename with orgunit and periods in output/ directory", () => {
    const output = formatPrefixedOutputPath("report.xlsx", "OU123", ["202601", "202602"]);
    expect(output).toBe(path.join("output", "OU123_202601-202602_report.xlsx"));
  });

  it("handles single period and custom dir path", () => {
    const output = formatPrefixedOutputPath("custom_folder/report.xlsx", "OU123", ["202601"]);
    expect(output).toBe(path.join("output", "custom_folder", "OU123_202601_report.xlsx"));
  });

  it("handles comma-separated parent org units by joining with underscore", () => {
    const output = formatPrefixedOutputPath("report.xlsx", "OU1, OU2,OU3", ["202601"]);
    expect(output).toBe(path.join("output", "OU1_OU2_OU3_202601_report.xlsx"));
  });

  it("handles array of parent org units by joining with underscore", () => {
    const output = formatPrefixedOutputPath("report.xlsx", ["OU1", "OU2"], ["202601"]);
    expect(output).toBe(path.join("output", "OU1_OU2_202601_report.xlsx"));
  });
});
