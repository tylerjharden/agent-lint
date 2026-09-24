import assert from "node:assert/strict";
import { test } from "node:test";
import { lanesFor, mutationConfigured, perfConfigured, unitBenchConfigured } from "../dist/lanes.js";

test("all without mutation.config stays three lanes", () => {
  assert.deepEqual(lanesFor("all", false), ["complexity", "cognitive", "architecture"]);
});

test("all with mutation.config adds mutation", () => {
  assert.deepEqual(lanesFor("all", true), [
    "complexity",
    "cognitive",
    "architecture",
    "mutation",
  ]);
});

test("all with perf.config adds perf", () => {
  assert.deepEqual(lanesFor("all", { perf: true }), [
    "complexity",
    "cognitive",
    "architecture",
    "perf",
  ]);
});

test("all with both opt-in lanes adds mutation then perf", () => {
  assert.deepEqual(lanesFor("all", { mutation: true, perf: true }), [
    "complexity",
    "cognitive",
    "architecture",
    "mutation",
    "perf",
  ]);
});

test("explicit mutation is always the mutation lane", () => {
  assert.deepEqual(lanesFor("mutation", false), ["mutation"]);
  assert.deepEqual(lanesFor("mutation", true), ["mutation"]);
});

test("explicit perf is always the perf lane", () => {
  assert.deepEqual(lanesFor("perf", {}), ["perf"]);
  assert.deepEqual(lanesFor("perf", { perf: true }), ["perf"]);
});

test("mutationConfigured is opt-in", () => {
  assert.equal(mutationConfigured({}), false);
  assert.equal(mutationConfigured({ mutation: { config: "stryker.config.json" } }), true);
});

test("perfConfigured is opt-in G1 config only", () => {
  assert.equal(perfConfigured({}), false);
  assert.equal(perfConfigured({ perf: { unitBench: "unit-bench.config.json" } }), false);
  assert.equal(perfConfigured({ perf: { config: "perf.config.json" } }), true);
});

test("unitBenchConfigured is opt-in and not G1", () => {
  assert.equal(unitBenchConfigured({}), false);
  assert.equal(unitBenchConfigured({ perf: { unitBench: "unit-bench.config.json" } }), true);
});
