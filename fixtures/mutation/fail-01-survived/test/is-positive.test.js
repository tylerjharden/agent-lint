import assert from "node:assert/strict";
import { test } from "node:test";
import { isPositive } from "../src/is-positive.js";

test("isPositive of one positive number", () => {
  assert.equal(isPositive(2), true);
});
