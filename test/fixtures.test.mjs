import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(root, "dist", "cli.js");
const bin = join(root, "bin", "agent-lint.js");
const fixtureConfig = join(root, "fixtures", "agent-lint.config.json");

const PASS_BOTH = [
  "fixtures/pass/pass-01-add.ts",
  "fixtures/pass/pass-02-greet.ts",
  "fixtures/pass/pass-03-clamp.ts",
];
const PASS_LIZARD = ["fixtures/pass/pass-04-add.py"];
const FAIL_CYCLO = [
  "fixtures/fail/fail-cyclo-01-many-ifs.ts",
  "fixtures/fail/fail-cyclo-02-switch.ts",
  "fixtures/fail/fail-cyclo-03-boolean-soup.ts",
];
const FAIL_CYCLO_PY = ["fixtures/fail/fail-cyclo-04-nested.py"];
const FAIL_COG = [
  "fixtures/fail/fail-cog-01-deep-nest.ts",
  "fixtures/fail/fail-cog-02-nested-loops.ts",
  "fixtures/fail/fail-cog-03-mixed-control.ts",
];
const PASS_ARCH = [
  "fixtures/arch/pass-01-ui-to-app",
  "fixtures/arch/pass-02-app-to-domain",
  "fixtures/arch/pass-03-domain-only",
];
const FAIL_ARCH = [
  ["fixtures/arch/fail-01-domain-to-ui", "no-domain-to-ui"],
  ["fixtures/arch/fail-02-circular", "no-circular"],
  ["fixtures/arch/fail-03-app-to-ui", "no-app-to-ui"],
];

function run(args, options = {}) {
  return spawnSync(process.execPath, [cli, "--config", fixtureConfig, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

test("help exits 0", () => {
  const result = spawnSync(process.execPath, [cli, "--help"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /agent-lint/);
  assert.match(result.stdout, /mutation/);
});

test("node bin/agent-lint.js --version exits 0", () => {
  const result = spawnSync(process.execPath, [bin, "--version"], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /\d+\.\d+\.\d+/);
});

test("pass directory: all → 0", () => {
  const result = run(["all", "fixtures/pass", "--json"]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.findings.length, 0);
});

test("pass directory: complexity → 0", () => {
  const result = run(["complexity", "fixtures/pass"]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test("pass directory: cognitive → 0", () => {
  const result = run(["cognitive", "fixtures/pass"]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

for (const file of PASS_BOTH) {
  test(`golden pass (both lanes): ${file}`, () => {
    const result = run(["all", file, "--json"]);
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
}

for (const file of PASS_LIZARD) {
  test(`golden pass (lizard): ${file}`, () => {
    const result = run(["complexity", file]);
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
}

for (const file of FAIL_CYCLO) {
  test(`golden fail (complexity): ${file}`, () => {
    const result = run(["complexity", file, "--json"]);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    const body = JSON.parse(result.stdout);
    assert.ok(body.findings.length > 0);
    assert.ok(body.findings.every((f) => f.lane === "complexity" && f.kind === "metric"));
  });
}

for (const file of FAIL_CYCLO_PY) {
  test(`golden fail (lizard): ${file}`, () => {
    const result = run(["complexity", file, "--json"]);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    const body = JSON.parse(result.stdout);
    assert.ok(body.findings.some((f) => f.tool === "lizard"));
  });
}

for (const file of FAIL_COG) {
  test(`golden fail (cognitive): ${file}`, () => {
    const result = run(["cognitive", file, "--json"]);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    const body = JSON.parse(result.stdout);
    assert.ok(body.findings.some((f) => f.lane === "cognitive"));
  });
}

test("fail directory: all → 1", () => {
  const result = run(["all", "fixtures/fail"]);
  assert.equal(result.status, 1, result.stderr + result.stdout);
});

test("broken JSON config → 2", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "--config", "test/broken/not-json.json", "fixtures/pass/pass-01-add.ts"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("invalid threshold → 2", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "--config", "test/broken/invalid-max.json", "fixtures/pass/pass-01-add.ts"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("unknown cyclomatic tool → 2", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "--config", "test/broken/bad-tools.json", "fixtures/pass/pass-01-add.ts"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("missing path → 2", () => {
  const result = run(["all", "fixtures/does-not-exist.ts"]);
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("missing config file → 2", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "--config", "nope.json", "fixtures/pass/pass-01-add.ts"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("cognitive on Python-only input → 2", () => {
  const result = run(["cognitive", "fixtures/pass/pass-04-add.py"]);
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("stdin path list of pass files → 0", () => {
  const result = run(["complexity", "--stdin", "--json"], {
    input: `${PASS_BOTH.join("\n")}\n`,
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
});

test("stdin-code of a simple snippet → 0", () => {
  const result = run(
    ["all", "--stdin-code", "--stdin-file-path", "snippet.ts", "--json"],
    { input: "export function add(a: number, b: number) { return a + b; }\n" },
  );
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.findings.length, 0);
  assert.deepEqual(body.lanes, ["complexity", "cognitive"]);
});

test("SARIF output includes runs[]", () => {
  const result = run(["complexity", FAIL_CYCLO[0], "--format", "sarif"]);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.version, "2.1.0");
  assert.ok(Array.isArray(body.runs));
  assert.ok(body.runs[0].results.length > 0);
});

for (const dir of PASS_ARCH) {
  test(`golden pass (arch): ${dir}`, () => {
    const result = run(["arch", dir, "--json"]);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const body = JSON.parse(result.stdout);
    assert.equal(body.ok, true);
    assert.equal(body.findings.length, 0);
  });
}

for (const [dir, rule] of FAIL_ARCH) {
  test(`golden fail (arch): ${dir}`, () => {
    const result = run(["arch", dir, "--json"]);
    assert.equal(result.status, 1, result.stderr + result.stdout);
    const body = JSON.parse(result.stdout);
    const hit = body.findings.find((f) => f.rule === rule);
    assert.ok(hit, result.stdout);
    assert.equal(hit.kind, "rule");
    assert.equal(hit.lane, "architecture");
    assert.equal(hit.tool, "dependency-cruiser");
    assert.equal(hit.line, 1);
    assert.equal(typeof hit.to, "string");
    assert.notEqual(hit.to, "");
  });
}

test("all includes architecture on a clean graph → 0", () => {
  const result = run(["all", "fixtures/arch/pass-03-domain-only", "--json"]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.deepEqual(body.lanes, ["complexity", "cognitive", "architecture"]);
  assert.equal(body.findings.length, 0);
});

test("all includes architecture on a forbidden edge → 1", () => {
  const result = run(["all", "fixtures/arch/fail-01-domain-to-ui", "--json"]);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.ok(body.lanes.includes("architecture"));
  assert.ok(body.findings.some((f) => f.kind === "rule" && f.rule === "no-domain-to-ui"));
});

test("arch fail human line names the edge", () => {
  const result = run(["arch", "fixtures/arch/fail-01-domain-to-ui"]);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stdout, /→ .+ \[dependency-cruiser\]  no-domain-to-ui/);
});

test("arch --stdin-code → 2", () => {
  const result = run(
    ["arch", "--stdin-code", "--stdin-file-path", "snippet.ts"],
    { input: "export function add(a: number, b: number) { return a + b; }\n" },
  );
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("missing architecture rule file → 2", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "--config", "test/broken/missing-arch.json", "arch", "fixtures/pass/pass-01-add.ts"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("broken architecture rule file → 2", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "--config", "test/broken/throws-arch.json", "arch", "fixtures/arch/pass-03-domain-only"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("zero-module cruise → 2", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "--config", "test/broken/empty-cruise.json", "arch", "fixtures/arch/pass-01-ui-to-app"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 2, result.stderr + result.stdout);
  assert.match(`${result.stderr}${result.stdout}`, /0 modules/);
});

test("warn severity does not fail the architecture gate", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "--config", "test/broken/warn-arch.json", "arch", "fixtures/arch/pass-01-ui-to-app", "--json"],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.findings.length, 0);
});

test("unknown flag → 2", () => {
  const result = run(["all", "--not-a-real-flag"]);
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

function runMutation(args, options = {}) {
  return spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

test("mutate alias on a healthy fixture → 0", () => {
  const result = runMutation([
    "--config",
    "test/mutation-enabled.json",
    "mutate",
    "fixtures/mutation/pass-01-add",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.findings.length, 0);
  assert.ok(body.lanes.includes("mutation"));
});

test("mutation score below break → 1", () => {
  const result = runMutation([
    "--config",
    "test/mutation-fail.json",
    "mutation",
    "fixtures/mutation/fail-01-survived",
    "--json",
  ]);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.findings.length, 1);
  const finding = body.findings[0];
  assert.equal(finding.kind, "score");
  assert.equal(finding.lane, "mutation");
  assert.equal(finding.tool, "stryker");
  assert.equal(finding.rule, "mutation-score");
  assert.equal(finding.threshold, 80);
  assert.ok(finding.value < finding.threshold);
});

test("mutation fail human line uses <", () => {
  const result = runMutation([
    "--config",
    "test/mutation-fail.json",
    "mutation",
    "fixtures/mutation/fail-01-survived",
  ]);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stdout, /mutation-score .+ < .+ \[stryker\]/);
});

test("zero valid mutants → 2", () => {
  const result = runMutation([
    "--config",
    "test/mutation-empty.json",
    "mutation",
    "fixtures/mutation/empty-01-no-mutants",
  ]);
  assert.equal(result.status, 2, result.stderr + result.stdout);
  assert.match(`${result.stderr}${result.stdout}`, /unscorable|0 valid mutant|No files to mutate|no mutant/i);
});

test("all without mutation.config does not start Stryker", () => {
  const result = run(["all", "fixtures/pass", "--json"]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.deepEqual(body.lanes, ["complexity", "cognitive", "architecture"]);
});

test("all with mutation.config includes mutation → 0", () => {
  const result = runMutation([
    "--config",
    "test/mutation-enabled.json",
    "all",
    "fixtures/pass",
    "--json",
  ]);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.deepEqual(body.lanes, ["complexity", "cognitive", "architecture", "mutation"]);
  assert.equal(body.findings.length, 0);
});

test("all --stdin-code skips mutation even when configured", () => {
  const result = runMutation(
    [
      "--config",
      "test/mutation-enabled.json",
      "all",
      "--stdin-code",
      "--stdin-file-path",
      "snippet.ts",
      "--json",
    ],
    { input: "export function add(a: number, b: number) { return a + b; }\n" },
  );
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const body = JSON.parse(result.stdout);
  assert.deepEqual(body.lanes, ["complexity", "cognitive"]);
});

test("mutation --stdin-code → 2", () => {
  const result = runMutation(
    [
      "--config",
      "test/mutation-enabled.json",
      "mutation",
      "--stdin-code",
      "--stdin-file-path",
      "snippet.ts",
    ],
    { input: "export function add(a: number, b: number) { return a + b; }\n" },
  );
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("missing Stryker config file → 2", () => {
  const result = runMutation([
    "--config",
    "test/broken/missing-mutation.json",
    "mutation",
    "fixtures/mutation/pass-01-add",
  ]);
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("mutation.config unset on explicit mutation → 2", () => {
  const result = runMutation([
    "--config",
    "test/broken/no-mutation-key.json",
    "mutation",
    "fixtures/mutation/pass-01-add",
  ]);
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("empty mutation.config → 2", () => {
  const result = runMutation([
    "--config",
    "test/broken/empty-mutation-config.json",
    "mutation",
    "fixtures/mutation/pass-01-add",
  ]);
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("broken Stryker config file → 2", () => {
  const result = runMutation([
    "--config",
    "test/broken/throws-mutation.json",
    "mutation",
    "fixtures/mutation/pass-01-add",
  ]);
  assert.equal(result.status, 2, result.stderr + result.stdout);
});

test("invalid Stryker JSON → 2", () => {
  const result = runMutation([
    "--config",
    "test/broken/not-json-mutation.json",
    "mutation",
    "fixtures/mutation/pass-01-add",
  ]);
  assert.equal(result.status, 2, result.stderr + result.stdout);
});
