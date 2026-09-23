import assert from "node:assert/strict";
import { test } from "node:test";
import { add } from "../src/add.js";

test("add kills arithmetic mutants", () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(2, 0), 2);
  assert.equal(add(0, 3), 3);
  assert.equal(add(-1, 1), 0);
  assert.equal(add(1, -1), 0);
});
