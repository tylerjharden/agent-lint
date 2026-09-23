import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultConfig, parseConfigJson } from "../dist/config.js";

test("defaultConfig does not imply a Stryker file", () => {
  assert.equal(defaultConfig().mutation, undefined);
});

test("parseConfigJson without mutation key leaves mutation unset", () => {
  const config = parseConfigJson(
    '{"cyclomatic":{"max":10,"tools":["eslint"]},"cognitive":{"max":15}}',
    "inline",
  );
  assert.equal(config.mutation, undefined);
});

test("empty mutation.config throws", () => {
  assert.throws(
    () => parseConfigJson('{"mutation":{"config":""}}', "inline"),
    /mutation\.config must be a non-empty string/,
  );
});

test("non-object mutation throws", () => {
  assert.throws(
    () => parseConfigJson('{"mutation":"stryker.config.json"}', "inline"),
    /mutation must be an object/,
  );
});

test("defaultConfig does not imply a perf file", () => {
  assert.equal(defaultConfig().perf, undefined);
});

test("parseConfigJson without perf key leaves perf unset", () => {
  const config = parseConfigJson(
    '{"cyclomatic":{"max":10,"tools":["eslint"]},"cognitive":{"max":15}}',
    "inline",
  );
  assert.equal(config.perf, undefined);
});

test("empty perf.config throws", () => {
  assert.throws(
    () => parseConfigJson('{"perf":{"config":""}}', "inline"),
    /perf\.config must be a non-empty string/,
  );
});

test("non-object perf throws", () => {
  assert.throws(
    () => parseConfigJson('{"perf":"perf.config.json"}', "inline"),
    /perf must be an object/,
  );
});
