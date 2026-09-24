import assert from "node:assert/strict";
import { test } from "node:test";
import {
  compareArtilleryP95,
  p95FromArtilleryReport,
  p95FromBaselineJson,
  parseNativeArtilleryConfig,
} from "../dist/runners/artillery.js";

test("parseNativeArtilleryConfig requires script and baseline", () => {
  const native = parseNativeArtilleryConfig(
    { script: "load.yml", baseline: "baseline.json", maxRegression: 0.5, ceiling: 2000 },
    "inline",
  );
  assert.equal(native.script, "load.yml");
  assert.equal(native.ceiling, 2000);
});

test("p95FromArtilleryReport reads aggregate summaries", () => {
  const p95 = p95FromArtilleryReport({
    aggregate: {
      counters: { "http.responses": 1 },
      summaries: { "http.response_time": { p95: 12.5, mean: 8 } },
    },
  });
  assert.equal(p95, 12.5);
});

test("zero HTTP responses is unscorable", () => {
  assert.throws(
    () =>
      p95FromArtilleryReport({
        aggregate: { counters: { "http.responses": 0 }, summaries: {} },
      }),
    /0 HTTP responses/,
  );
});

test("baseline p95 must be > 0", () => {
  assert.throws(() => p95FromBaselineJson({ p95: 0 }, "inline"), /finite number > 0/);
});

test("compareArtilleryP95 passes under baseline * (1 + maxRegression)", () => {
  const findings = compareArtilleryP95(12, 10, 0.5, undefined, "perf.config.json");
  assert.equal(findings.length, 0);
});

test("compareArtilleryP95 fails when p95 exceeds the allowed mean", () => {
  const findings = compareArtilleryP95(20, 10, 0.5, undefined, "perf.config.json");
  assert.equal(findings.length, 1);
  const finding = findings[0];
  assert.equal(finding.kind, "timing");
  assert.equal(finding.tool, "artillery");
  assert.equal(finding.rule, "load-regression");
  assert.equal(finding.gate, "load");
  assert.equal(finding.metric, "p95");
  assert.equal(finding.threshold, 15);
});

test("compareArtilleryP95 fails an absolute ceiling", () => {
  const findings = compareArtilleryP95(12, 20, 0.5, 10, "perf.config.json");
  assert.equal(findings.length, 1);
  assert.equal(findings[0].rule, "load-ceiling");
  assert.equal(findings[0].gate, "load");
});
