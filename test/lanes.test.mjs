import assert from "node:assert/strict";
import { test } from "node:test";
import { lanesFor, mutationConfigured } from "../dist/lanes.js";

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

test("explicit mutation is always the mutation lane", () => {
  assert.deepEqual(lanesFor("mutation", false), ["mutation"]);
  assert.deepEqual(lanesFor("mutation", true), ["mutation"]);
});

test("mutationConfigured is opt-in", () => {
  assert.equal(mutationConfigured({}), false);
  assert.equal(mutationConfigured({ mutation: { config: "stryker.config.json" } }), true);
});
