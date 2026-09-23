import assert from "node:assert/strict";
import { test } from "node:test";
import {
  benchesFromBaselineJson,
  benchesFromVitestJson,
  compareToBaseline,
  parseNativePerfConfig,
} from "../dist/runners/vitest-bench.js";

test("parseNativePerfConfig defaults runner to vitest", () => {
  const native = parseNativePerfConfig(
    { config: "vitest.config.js", baseline: "baseline.json", maxRegression: 0.5 },
    "inline",
  );
  assert.equal(native.runner, "vitest");
  assert.equal(native.maxRegression, 0.5);
});

test("parseNativePerfConfig rejects hyperfine", () => {
  assert.throws(
    () =>
      parseNativePerfConfig(
        {
          runner: "hyperfine",
          config: "vitest.config.js",
          baseline: "baseline.json",
          maxRegression: 0.5,
        },
        "inline",
      ),
    /runner must be "vitest"/,
  );
});

test("benchesFromVitestJson reads files/groups/benchmarks", () => {
  const benches = benchesFromVitestJson({
    files: [
      {
        filepath: "add.bench.js",
        groups: [{ fullName: "add.bench.js", benchmarks: [{ name: "add", mean: 0.002, hz: 500 }] }],
      },
    ],
  });
  assert.deepEqual(benches, [{ name: "add", mean: 0.002, hz: 500 }]);
});

test("zero benches is unscorable", () => {
  assert.throws(
    () => benchesFromVitestJson({ files: [{ filepath: "empty.bench.js", groups: [] }] }),
    /0 benches/,
  );
});

test("baseline mean must be > 0", () => {
  assert.throws(
    () => benchesFromBaselineJson({ benches: [{ name: "add", mean: 0 }] }, "inline"),
    /finite number > 0/,
  );
});

test("compareToBaseline passes under the allowed mean", () => {
  const findings = compareToBaseline(
    [{ name: "add", mean: 0.012 }],
    [{ name: "add", mean: 0.01 }],
    0.5,
    "perf.config.json",
  );
  assert.equal(findings.length, 0);
});

test("compareToBaseline fails when mean exceeds baseline * (1 + maxRegression)", () => {
  const findings = compareToBaseline(
    [{ name: "add", mean: 0.02 }],
    [{ name: "add", mean: 0.01 }],
    0.5,
    "perf.config.json",
  );
  assert.equal(findings.length, 1);
  const finding = findings[0];
  assert.equal(finding.kind, "timing");
  assert.equal(finding.lane, "perf");
  assert.equal(finding.tool, "vitest");
  assert.equal(finding.rule, "perf-regression");
  assert.equal(finding.bench, "add");
  assert.equal(finding.baseline, 0.01);
  assert.equal(finding.threshold, 0.015);
  assert.ok(finding.value > finding.threshold);
});

test("missing baseline name is unscorable", () => {
  assert.throws(
    () => compareToBaseline([{ name: "mul", mean: 0.01 }], [{ name: "add", mean: 0.01 }], 0.5, "x"),
    /no baseline entry/,
  );
});
