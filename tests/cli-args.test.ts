import { describe, it, expect } from "vitest";
import { normalizeArgs } from "../src/utils/args-normalizer.js";

describe("CLI Argument Normalization", () => {
  it("normalizes multi-letter single dash flags with =", () => {
    const input = [
      "node",
      "index.ts",
      "-ou=SkCh5O8W0No",
      "-ds=WqMbv5DkReA",
      "-pe=2026,2025",
    ];
    const expected = [
      "node",
      "index.ts",
      "--parentOrgUnit=SkCh5O8W0No",
      "--dataSet=WqMbv5DkReA",
      "--periods=2026,2025",
    ];
    expect(normalizeArgs(input)).toEqual(expected);
  });

  it("normalizes multi-letter single dash flags with space separation", () => {
    const input = [
      "node",
      "index.ts",
      "-ou",
      "SkCh5O8W0No",
      "-ds",
      "WqMbv5DkReA",
      "-pe",
      "2026,2025",
    ];
    const expected = [
      "node",
      "index.ts",
      "--parentOrgUnit",
      "SkCh5O8W0No",
      "--dataSet",
      "WqMbv5DkReA",
      "--periods",
      "2026,2025",
    ];
    expect(normalizeArgs(input)).toEqual(expected);
  });

  it("strips standalone -- passed by pnpm", () => {
    const input = [
      "node",
      "index.ts",
      "--",
      "-ou=SkCh5O8W0No",
      "-ds",
      "WqMbv5DkReA",
      "-pe",
      "2026,2025",
      "-lvl=4",
    ];
    const expected = [
      "node",
      "index.ts",
      "--parentOrgUnit=SkCh5O8W0No",
      "--dataSet",
      "WqMbv5DkReA",
      "--periods",
      "2026,2025",
      "--level=4",
    ];
    expect(normalizeArgs(input)).toEqual(expected);
  });
});
