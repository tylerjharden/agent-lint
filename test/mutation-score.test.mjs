import assert from "node:assert/strict";
import { test } from "node:test";
import { scoreFromMutants } from "../dist/runners/stryker.js";

test("score is detected / valid * 100", () => {
  const score = scoreFromMutants([
    { status: "Killed" },
    { status: "Killed" },
    { status: "Timeout" },
    { status: "Survived" },
    { status: "NoCoverage" },
    { status: "CompileError" },
  ]);
  assert.equal(score.killed, 2);
  assert.equal(score.timeout, 1);
  assert.equal(score.survived, 1);
  assert.equal(score.noCoverage, 1);
  assert.equal(score.valid, 5);
  assert.equal(score.mutationScore, 60);
});

test("zero valid mutants is unscorable", () => {
  const score = scoreFromMutants([{ status: "CompileError" }, { status: "Ignored" }]);
  assert.equal(score.valid, 0);
  assert.equal(Number.isFinite(score.mutationScore), false);
});
