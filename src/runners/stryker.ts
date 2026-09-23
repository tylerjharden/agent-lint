import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { GateError } from "../errors.js";
import type { ScoreFinding } from "../types.js";
import { loadStryker, type MutantLike } from "./load-stryker.js";

export interface MutationRunResult {
  findings: ScoreFinding[];
  breakThreshold: number | null;
}

export interface MutationScore {
  mutationScore: number;
  killed: number;
  survived: number;
  noCoverage: number;
  timeout: number;
  valid: number;
}

export function scoreFromMutants(results: readonly MutantLike[]): MutationScore {
  let killed = 0;
  let survived = 0;
  let noCoverage = 0;
  let timeout = 0;
  for (const mutant of results) {
    switch (mutant.status) {
      case "Killed":
        killed += 1;
        break;
      case "Survived":
        survived += 1;
        break;
      case "NoCoverage":
        noCoverage += 1;
        break;
      case "Timeout":
        timeout += 1;
        break;
      default:
        break;
    }
  }
  const detected = killed + timeout;
  const valid = detected + survived + noCoverage;
  return {
    mutationScore: valid === 0 ? Number.NaN : (detected / valid) * 100,
    killed,
    survived,
    noCoverage,
    timeout,
    valid,
  };
}

function requireMutationFile(configPath: string, cwd: string): string {
  const resolved = resolve(cwd, configPath);
  if (!existsSync(resolved)) {
    throw new GateError(
      `Stryker config not found: ${configPath}. Copy templates/mutation/stryker.config.json and point mutation.config at it.`,
    );
  }
  return resolved;
}

function breakFromNative(native: Record<string, unknown>): number | null {
  const thresholds = native.thresholds;
  if (thresholds === undefined) {
    return null;
  }
  if (thresholds === null || typeof thresholds !== "object" || Array.isArray(thresholds)) {
    throw new GateError("Stryker thresholds must be an object");
  }
  const breakAt = (thresholds as { break?: unknown }).break;
  if (breakAt === undefined || breakAt === null) {
    return null;
  }
  if (typeof breakAt !== "number" || !Number.isFinite(breakAt)) {
    throw new GateError(
      `Stryker thresholds.break must be a number or null, got ${JSON.stringify(breakAt)}`,
    );
  }
  return breakAt;
}

async function loadNativeStrykerFile(resolved: string): Promise<Record<string, unknown>> {
  if (resolved.endsWith(".json")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(resolved, "utf8"));
    } catch (cause) {
      throw new GateError(`Invalid JSON in Stryker config ${resolved}`, { cause });
    }
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new GateError(`Stryker config ${resolved} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  }
  const imported = (await import(pathToFileURL(resolved).href)) as {
    default?: unknown;
  };
  const value = imported.default ?? imported;
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GateError(`Stryker config ${resolved} must export an object`);
  }
  return value as Record<string, unknown>;
}

function wrapStrykerError(cause: unknown): never {
  if (cause instanceof GateError) {
    throw cause;
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  throw new GateError(`Stryker failed: ${message}`, { cause });
}

function requireFiniteScore(score: MutationScore): void {
  if (score.valid < 1 || !Number.isFinite(score.mutationScore)) {
    throw new GateError(
      "Stryker produced an unscorable run (0 valid mutants). Mutation cannot pass without a finite score.",
    );
  }
}

function findingFromScore(
  score: MutationScore,
  breakThreshold: number,
  configPath: string,
): ScoreFinding {
  const value = Number(score.mutationScore.toFixed(2));
  return {
    kind: "score",
    lane: "mutation",
    tool: "stryker",
    rule: "mutation-score",
    file: configPath,
    line: 1,
    value,
    threshold: breakThreshold,
    killed: score.killed,
    survived: score.survived,
    noCoverage: score.noCoverage,
    timeout: score.timeout,
    message: `mutation-score ${value} (break ${breakThreshold}; killed ${score.killed}, survived ${score.survived})`,
  };
}

async function runInConfigDir(resolved: string): Promise<MutationRunResult> {
  const native = await loadNativeStrykerFile(resolved);
  const breakThreshold = breakFromNative(native);
  const api = await loadStryker();
  const results = await api.runMutationTest(resolved);
  const score = scoreFromMutants(results);
  requireFiniteScore(score);
  if (breakThreshold === null || score.mutationScore >= breakThreshold) {
    return { findings: [], breakThreshold };
  }
  return {
    findings: [findingFromScore(score, breakThreshold, resolved)],
    breakThreshold,
  };
}

async function withConfigCwd<T>(workdir: string, run: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(workdir);
  try {
    return await run();
  } finally {
    process.chdir(previous);
  }
}

async function withStrykerProcessIsolation<T>(run: () => Promise<T>): Promise<T> {
  // Nested `node --test` inherits NODE_TEST_CONTEXT and will not score the fixture.
  const testContext = process.env.NODE_TEST_CONTEXT;
  delete process.env.NODE_TEST_CONTEXT;
  const stdoutWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((..._args: Parameters<typeof process.stdout.write>) =>
    true) as typeof process.stdout.write;
  try {
    return await run();
  } finally {
    process.stdout.write = stdoutWrite;
    if (testContext === undefined) {
      delete process.env.NODE_TEST_CONTEXT;
    } else {
      process.env.NODE_TEST_CONTEXT = testContext;
    }
  }
}

export async function runStryker(
  configPath: string,
  cwd = process.cwd(),
): Promise<MutationRunResult> {
  const resolved = requireMutationFile(configPath, cwd);
  try {
    return await withStrykerProcessIsolation(() =>
      withConfigCwd(dirname(resolved), () => runInConfigDir(resolved)),
    );
  } catch (cause) {
    wrapStrykerError(cause);
  }
}
