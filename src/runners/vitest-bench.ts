import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { GateError } from "../errors.js";
import type { TimingFinding } from "../types.js";
import { resolveVitestCli } from "./load-vitest.js";

export interface PerfRunResult {
  findings: TimingFinding[];
  maxRegression: number;
}

export interface BenchSample {
  name: string;
  mean: number;
  hz?: number;
}

export interface NativePerfConfig {
  runner: "vitest";
  config: string;
  baseline: string;
  maxRegression: number;
}

const VITEST_TIMEOUT_MS = 30_000;

function requireFile(path: string, message: string): string {
  if (!existsSync(path)) {
    throw new GateError(message);
  }
  return path;
}

function parseJsonFile(path: string, label: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new GateError(`Invalid JSON in ${label} ${path}`, { cause });
  }
}

function requireObject(value: unknown, label: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GateError(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new GateError(`${label} must be a non-empty string`);
  }
  return value;
}

function requireMaxRegression(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new GateError(
      `perf maxRegression must be a finite number >= 0, got ${JSON.stringify(value)}`,
    );
  }
  return value;
}

export function parseNativePerfConfig(raw: unknown, source: string): NativePerfConfig {
  const body = requireObject(raw, `Perf config ${source}`);
  const runner = body.runner === undefined ? "vitest" : body.runner;
  if (runner !== "vitest") {
    throw new GateError(
      `perf runner must be "vitest", got ${JSON.stringify(runner)}. Hyperfine is not this wrap.`,
    );
  }
  return {
    runner: "vitest",
    config: requireNonEmptyString(body.config, "perf config"),
    baseline: requireNonEmptyString(body.baseline, "perf baseline"),
    maxRegression: requireMaxRegression(body.maxRegression),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function meanFromBench(bench: Record<string, unknown>): number {
  const mean = bench.mean;
  if (typeof mean !== "number" || !Number.isFinite(mean) || mean < 0) {
    throw new GateError(
      `Vitest bench mean is missing or not a finite number, got ${JSON.stringify(mean)}`,
    );
  }
  return mean;
}

function nameFromBench(bench: Record<string, unknown>): string {
  if (typeof bench.name !== "string" || bench.name.trim() === "") {
    throw new GateError("Vitest bench result is missing a name");
  }
  return bench.name;
}

function sampleFromBench(bench: unknown): BenchSample {
  const body = asRecord(bench);
  if (body === undefined) {
    throw new GateError("Vitest bench result is not an object");
  }
  const hz = body.hz;
  const sample: BenchSample = {
    name: nameFromBench(body),
    mean: meanFromBench(body),
  };
  if (typeof hz === "number" && Number.isFinite(hz)) {
    sample.hz = hz;
  }
  return sample;
}

function benchesFromGroup(group: unknown): BenchSample[] {
  const body = asRecord(group);
  if (body === undefined || !Array.isArray(body.benchmarks)) {
    throw new GateError("Vitest bench group is missing benchmarks[]");
  }
  return body.benchmarks.map(sampleFromBench);
}

function benchesFromFile(file: unknown): BenchSample[] {
  const body = asRecord(file);
  if (body === undefined || !Array.isArray(body.groups)) {
    throw new GateError("Vitest bench file is missing groups[]");
  }
  return body.groups.flatMap(benchesFromGroup);
}

export function benchesFromVitestJson(raw: unknown): BenchSample[] {
  const body = asRecord(raw);
  if (body === undefined || !Array.isArray(body.files)) {
    throw new GateError("Vitest bench JSON is missing files[]");
  }
  const benches = body.files.flatMap(benchesFromFile);
  if (benches.length === 0) {
    throw new GateError("Vitest bench produced an unscorable run (0 benches).");
  }
  return benches;
}

function sampleFromBaselineEntry(entry: unknown): BenchSample {
  const body = asRecord(entry);
  if (body === undefined) {
    throw new GateError("baseline benches[] entry must be an object");
  }
  const name = requireNonEmptyString(body.name, "baseline bench name");
  const mean = body.mean;
  if (typeof mean !== "number" || !Number.isFinite(mean) || mean <= 0) {
    throw new GateError(
      `baseline mean for ${name} must be a finite number > 0, got ${JSON.stringify(mean)}`,
    );
  }
  return { name, mean };
}

export function benchesFromBaselineJson(raw: unknown, source: string): BenchSample[] {
  const body = requireObject(raw, `Baseline ${source}`);
  if (!Array.isArray(body.benches)) {
    throw new GateError(`Baseline ${source} must have a benches array`);
  }
  const benches = body.benches.map(sampleFromBaselineEntry);
  if (benches.length === 0) {
    throw new GateError(`Baseline ${source} has 0 benches. Perf cannot pass without a baseline.`);
  }
  return benches;
}

function mapByName(samples: readonly BenchSample[]): Map<string, BenchSample> {
  const map = new Map<string, BenchSample>();
  for (const sample of samples) {
    if (map.has(sample.name)) {
      throw new GateError(`Duplicate bench name ${JSON.stringify(sample.name)}`);
    }
    map.set(sample.name, sample);
  }
  return map;
}

function nameSet(samples: readonly BenchSample[]): Set<string> {
  return new Set(samples.map((sample) => sample.name));
}

export function requireMatchingBenchNames(
  current: readonly BenchSample[],
  baseline: readonly BenchSample[],
): void {
  const currentNames = nameSet(current);
  const baselineNames = nameSet(baseline);
  for (const name of currentNames) {
    if (!baselineNames.has(name)) {
      throw new GateError(
        `Bench ${JSON.stringify(name)} has no baseline entry. Perf cannot score an unnamed run.`,
      );
    }
  }
  for (const name of baselineNames) {
    if (!currentNames.has(name)) {
      throw new GateError(
        `Baseline bench ${JSON.stringify(name)} did not run. Perf cannot score a missing bench.`,
      );
    }
  }
}

function allowedMean(baselineMean: number, maxRegression: number): number {
  return baselineMean * (1 + maxRegression);
}

function findingIfRegressed(
  current: BenchSample,
  baseline: BenchSample,
  maxRegression: number,
  sourceFile: string,
): TimingFinding | undefined {
  const threshold = allowedMean(baseline.mean, maxRegression);
  if (current.mean <= threshold) {
    return undefined;
  }
  const value = Number(current.mean.toFixed(8));
  return {
    kind: "timing",
    lane: "perf",
    tool: "vitest",
    rule: "perf-regression",
    file: sourceFile,
    line: 1,
    bench: current.name,
    value,
    baseline: baseline.mean,
    threshold,
    hz: current.hz,
    message: `perf-regression ${current.name} mean ${value} > ${threshold} (baseline ${baseline.mean}, maxRegression ${maxRegression})`,
  };
}

export function compareToBaseline(
  current: readonly BenchSample[],
  baseline: readonly BenchSample[],
  maxRegression: number,
  sourceFile: string,
): TimingFinding[] {
  requireMatchingBenchNames(current, baseline);
  const baseByName = mapByName(baseline);
  const findings: TimingFinding[] = [];
  for (const sample of current) {
    const expected = baseByName.get(sample.name);
    if (expected === undefined) {
      throw new GateError(`Bench ${JSON.stringify(sample.name)} has no baseline entry.`);
    }
    const finding = findingIfRegressed(sample, expected, maxRegression, sourceFile);
    if (finding !== undefined) {
      findings.push(finding);
    }
  }
  return findings;
}

function envWithoutTestContext(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return env;
}

function spawnFailedMessage(status: number | null, stderr: string, stdout: string): string {
  const detail = `${stderr}\n${stdout}`.trim();
  return `Vitest bench exited ${String(status)}. ${detail || "No output."}`.trim();
}

function runVitestCli(
  cli: string,
  configFile: string,
  outputFile: string,
  workdir: string,
): { status: number | null; stderr: string; stdout: string } {
  const result = spawnSync(
    process.execPath,
    [cli, "bench", "--config", configFile, "--outputJson", outputFile, "--run"],
    {
      cwd: workdir,
      encoding: "utf8",
      env: envWithoutTestContext(),
      timeout: VITEST_TIMEOUT_MS,
    },
  );
  if (result.error !== undefined) {
    throw new GateError(`Vitest bench failed to start: ${result.error.message}`, {
      cause: result.error,
    });
  }
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function currentBenchesFromOutput(
  outputFile: string,
  spawned: { status: number | null; stderr: string; stdout: string },
): BenchSample[] {
  if (!existsSync(outputFile)) {
    throw new GateError(spawnFailedMessage(spawned.status, spawned.stderr, spawned.stdout));
  }
  let raw: unknown;
  try {
    raw = parseJsonFile(outputFile, "Vitest bench output");
  } catch (cause) {
    if (spawned.status !== 0) {
      throw new GateError(spawnFailedMessage(spawned.status, spawned.stderr, spawned.stdout), {
        cause,
      });
    }
    throw cause;
  }
  const benches = benchesFromVitestJson(raw);
  if (spawned.status !== 0) {
    throw new GateError(
      `Vitest bench exited ${String(spawned.status)} after scoring. Perf cannot trust this run.`,
    );
  }
  return benches;
}

function loadNativeFromDisk(resolved: string): NativePerfConfig {
  return parseNativePerfConfig(parseJsonFile(resolved, "perf config"), resolved);
}

function compareRun(
  native: NativePerfConfig,
  workdir: string,
  resolved: string,
): PerfRunResult {
  const vitestConfig = requireFile(
    resolve(workdir, native.config),
    `Vitest config not found: ${native.config}. Copy templates/perf/vitest.config.js and point perf config at it.`,
  );
  const baselinePath = requireFile(
    resolve(workdir, native.baseline),
    `Perf baseline not found: ${native.baseline}. Copy templates/perf/baseline.json, record means, and point baseline at it.`,
  );
  const baseline = benchesFromBaselineJson(parseJsonFile(baselinePath, "perf baseline"), baselinePath);
  const scratch = mkdtempSync(join(tmpdir(), "agent-lint-perf-"));
  const outputFile = join(scratch, "vitest-bench.json");
  try {
    const spawned = runVitestCli(resolveVitestCli(), vitestConfig, outputFile, workdir);
    const current = currentBenchesFromOutput(outputFile, spawned);
    return {
      findings: compareToBaseline(current, baseline, native.maxRegression, resolved),
      maxRegression: native.maxRegression,
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function wrapVitestError(cause: unknown): never {
  if (cause instanceof GateError) {
    throw cause;
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  throw new GateError(`Vitest bench failed: ${message}`, { cause });
}

export async function runVitestBench(
  configPath: string,
  cwd = process.cwd(),
): Promise<PerfRunResult> {
  const resolved = requireFile(
    resolve(cwd, configPath),
    `Perf config not found: ${configPath}. Copy templates/perf/perf.config.json and point perf.config at it.`,
  );
  try {
    const native = loadNativeFromDisk(resolved);
    return compareRun(native, dirname(resolved), resolved);
  } catch (cause) {
    wrapVitestError(cause);
  }
}
