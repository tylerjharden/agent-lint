import assert from "node:assert/strict";
import { test } from "node:test";
import {
  lanesFor,
  loadConfigured,
  microConfigured,
  mutationConfigured,
  perfConfigured,
} from "../dist/lanes.js";

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

test("perfConfigured is opt-in for either Perf lock", () => {
  assert.equal(perfConfigured({}), false);
  assert.equal(perfConfigured({ perf: { micro: "micro.config.json" } }), true);
  assert.equal(perfConfigured({ perf: { load: "perf.config.json" } }), true);
});

test("microConfigured is the micro-bench lock", () => {
  assert.equal(microConfigured({}), false);
  assert.equal(microConfigured({ perf: { micro: "micro.config.json" } }), true);
  assert.equal(microConfigured({ perf: { load: "perf.config.json" } }), false);
});

test("loadConfigured is the load/soak lock", () => {
  assert.equal(loadConfigured({}), false);
  assert.equal(loadConfigured({ perf: { load: "perf.config.json" } }), true);
  assert.equal(loadConfigured({ perf: { micro: "micro.config.json" } }), false);
});
