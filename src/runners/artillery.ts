import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { GateError } from "../errors.js";
import type { TimingFinding } from "../types.js";
import { resolveArtilleryCli } from "./load-artillery.js";
import { waitForPort } from "./wait-port.js";

export interface ArtilleryRunResult {
  findings: TimingFinding[];
  maxRegression: number;
}

export interface NativeArtilleryConfig {
  script: string;
  baseline: string;
  maxRegression: number;
  ceiling?: number;
  server?: string;
  port?: number;
}

const ARTILLERY_TIMEOUT_MS = 60_000;
const SERVER_WAIT_MS = 5_000;
const HOST = "127.0.0.1";

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

function optionalPositiveNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new GateError(`${label} must be a finite number > 0, got ${JSON.stringify(value)}`);
  }
  return value;
}

export function parseNativeArtilleryConfig(raw: unknown, source: string): NativeArtilleryConfig {
  const body = requireObject(raw, `Perf config ${source}`);
  return {
    script: requireNonEmptyString(body.script, "perf script"),
    baseline: requireNonEmptyString(body.baseline, "perf baseline"),
    maxRegression: requireMaxRegression(body.maxRegression),
    ceiling: optionalPositiveNumber(body.ceiling, "perf ceiling"),
    server:
      body.server === undefined ? undefined : requireNonEmptyString(body.server, "perf server"),
    port: optionalPositiveNumber(body.port, "perf port"),
  };
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function responseCount(aggregate: Record<string, unknown>): number {
  const counters = asRecord(aggregate.counters);
  const responses = counters?.["http.responses"];
  if (typeof responses === "number" && Number.isFinite(responses)) {
    return responses;
  }
  return 0;
}

export function p95FromArtilleryReport(raw: unknown): number {
  const aggregate = asRecord(asRecord(raw)?.aggregate);
  if (aggregate === undefined) {
    throw new GateError("Artillery report is missing aggregate");
  }
  if (responseCount(aggregate) < 1) {
    throw new GateError("Artillery produced an unscorable run (0 HTTP responses).");
  }
  const summaries = asRecord(aggregate.summaries) ?? asRecord(aggregate.histograms);
  const latency = asRecord(summaries?.["http.response_time"]);
  const p95 = latency?.p95;
  if (typeof p95 !== "number" || !Number.isFinite(p95) || p95 < 0) {
    throw new GateError("Artillery report is missing a finite http.response_time.p95.");
  }
  return p95;
}

export function p95FromBaselineJson(raw: unknown, source: string): number {
  const body = requireObject(raw, `Baseline ${source}`);
  const p95 = body.p95;
  if (typeof p95 !== "number" || !Number.isFinite(p95) || p95 <= 0) {
    throw new GateError(
      `Baseline ${source} p95 must be a finite number > 0, got ${JSON.stringify(p95)}`,
    );
  }
  return p95;
}

function allowedP95(baseline: number, maxRegression: number): number {
  return baseline * (1 + maxRegression);
}

function timingFinding(
  rule: "load-regression" | "load-ceiling",
  value: number,
  baseline: number,
  threshold: number,
  sourceFile: string,
  message: string,
): TimingFinding {
  return {
    kind: "timing",
    lane: "perf",
    tool: "artillery",
    rule,
    gate: "load",
    file: sourceFile,
    line: 1,
    value,
    baseline,
    threshold,
    metric: "p95",
    message,
  };
}

export function compareArtilleryP95(
  current: number,
  baseline: number,
  maxRegression: number,
  ceiling: number | undefined,
  sourceFile: string,
): TimingFinding[] {
  const findings: TimingFinding[] = [];
  const threshold = allowedP95(baseline, maxRegression);
  if (current > threshold) {
    findings.push(
      timingFinding(
        "load-regression",
        current,
        baseline,
        threshold,
        sourceFile,
        `load-regression p95 ${current} > ${threshold} (baseline ${baseline}, maxRegression ${maxRegression})`,
      ),
    );
  }
  if (ceiling !== undefined && current > ceiling) {
    findings.push(
      timingFinding(
        "load-ceiling",
        current,
        ceiling,
        ceiling,
        sourceFile,
        `load-ceiling p95 ${current} > ${ceiling}`,
      ),
    );
  }
  return findings;
}

function artilleryEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  env.ARTILLERY_DISABLE_TELEMETRY = "1";
  return env;
}

function spawnFailedMessage(status: number | null, stderr: string, stdout: string): string {
  const detail = `${stderr}\n${stdout}`.trim();
  return `Artillery exited ${String(status)}. ${detail || "No output."}`.trim();
}

function runArtilleryCli(
  cli: string,
  script: string,
  outputFile: string,
  workdir: string,
  target: string | undefined,
): { status: number | null; stderr: string; stdout: string } {
  const args = [cli, "run", "--quiet", "--output", outputFile];
  if (target !== undefined) {
    args.push("--target", target);
  }
  args.push(script);
  const result = spawnSync(process.execPath, args, {
    cwd: workdir,
    encoding: "utf8",
    env: artilleryEnv(),
    timeout: ARTILLERY_TIMEOUT_MS,
  });
  if (result.error !== undefined) {
    throw new GateError(`Artillery failed to start: ${result.error.message}`, {
      cause: result.error,
    });
  }
  return { status: result.status, stderr: result.stderr, stdout: result.stdout };
}

function currentP95FromOutput(
  outputFile: string,
  spawned: { status: number | null; stderr: string; stdout: string },
): number {
  if (!existsSync(outputFile)) {
    throw new GateError(spawnFailedMessage(spawned.status, spawned.stderr, spawned.stdout));
  }
  let raw: unknown;
  try {
    raw = parseJsonFile(outputFile, "Artillery report");
  } catch (cause) {
    if (spawned.status !== 0) {
      throw new GateError(spawnFailedMessage(spawned.status, spawned.stderr, spawned.stdout), {
        cause,
      });
    }
    throw cause;
  }
  const p95 = p95FromArtilleryReport(raw);
  if (spawned.status !== 0) {
    throw new GateError(
      `Artillery exited ${String(spawned.status)} after scoring. Perf cannot trust this run.`,
    );
  }
  return p95;
}

function startServer(serverFile: string, port: number, workdir: string): ChildProcess {
  const child = spawn(process.execPath, [serverFile], {
    cwd: workdir,
    env: { ...process.env, AGENT_LINT_PERF_PORT: String(port) },
    stdio: "ignore",
  });
  if (child.pid === undefined) {
    throw new GateError(`Perf server failed to start: ${serverFile}`);
  }
  return child;
}

function stopServer(child: ChildProcess | undefined): void {
  if (child === undefined || child.killed) {
    return;
  }
  child.kill("SIGTERM");
}

async function withOptionalServer<T>(
  native: NativeArtilleryConfig,
  workdir: string,
  run: (target: string | undefined) => Promise<T>,
): Promise<T> {
  if (native.server === undefined) {
    return run(undefined);
  }
  const port = native.port;
  if (port === undefined) {
    throw new GateError("perf server requires perf port (a TCP port > 0)");
  }
  const serverFile = requireFile(
    resolve(workdir, native.server),
    `Perf server not found: ${native.server}`,
  );
  const child = startServer(serverFile, port, workdir);
  try {
    await waitForPort(port, HOST, SERVER_WAIT_MS);
    return await run(`http://${HOST}:${port}`);
  } finally {
    stopServer(child);
  }
}

async function compareRun(
  native: NativeArtilleryConfig,
  workdir: string,
  resolved: string,
): Promise<ArtilleryRunResult> {
  const script = requireFile(
    resolve(workdir, native.script),
    `Artillery script not found: ${native.script}. Copy templates/perf/load.yml and point perf script at it.`,
  );
  const baselinePath = requireFile(
    resolve(workdir, native.baseline),
    `Perf baseline not found: ${native.baseline}. Copy templates/perf/baseline.json, set p95, and point baseline at it.`,
  );
  const baseline = p95FromBaselineJson(parseJsonFile(baselinePath, "perf baseline"), baselinePath);
  const scratch = mkdtempSync(join(tmpdir(), "agent-lint-perf-"));
  const outputFile = join(scratch, "artillery.json");
  try {
    const current = await withOptionalServer(native, workdir, async (target) => {
      const spawned = runArtilleryCli(resolveArtilleryCli(), script, outputFile, workdir, target);
      return currentP95FromOutput(outputFile, spawned);
    });
    return {
      findings: compareArtilleryP95(
        current,
        baseline,
        native.maxRegression,
        native.ceiling,
        resolved,
      ),
      maxRegression: native.maxRegression,
    };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function wrapArtilleryError(cause: unknown): never {
  if (cause instanceof GateError) {
    throw cause;
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  throw new GateError(`Artillery failed: ${message}`, { cause });
}

export async function runArtillery(
  configPath: string,
  cwd = process.cwd(),
): Promise<ArtilleryRunResult> {
  const resolved = requireFile(
    resolve(cwd, configPath),
    `Load/soak config not found: ${configPath}. Copy templates/perf/perf.config.json and point perf.load at it.`,
  );
  try {
    const native = parseNativeArtilleryConfig(parseJsonFile(resolved, "perf config"), resolved);
    return await compareRun(native, dirname(resolved), resolved);
  } catch (cause) {
    wrapArtilleryError(cause);
  }
}
