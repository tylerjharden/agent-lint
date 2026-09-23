import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ICruiseOptions } from "dependency-cruiser";
import { GateError } from "../errors.js";
import { isJsTsFile } from "../extensions.js";
import type { RuleFinding } from "../types.js";
import { loadDepcruise, type DepcruiseApi } from "./load-depcruise.js";

type CruiseViolation = {
  from: string;
  to: string;
  rule: { name: string; severity: string };
  comment?: string;
};

function requireCruiseResult(output: unknown): {
  summary: { violations: CruiseViolation[]; totalCruised?: number };
} {
  if (output === null || typeof output !== "object" || !("summary" in output)) {
    throw new GateError("dependency-cruiser returned a report that is not a cruise result object");
  }
  const summary = (output as { summary?: unknown }).summary;
  if (summary === null || typeof summary !== "object" || !("violations" in summary)) {
    throw new GateError("dependency-cruiser result is missing summary.violations");
  }
  const violations = (summary as { violations?: unknown }).violations;
  if (!Array.isArray(violations)) {
    throw new GateError("dependency-cruiser summary.violations is not an array");
  }
  return output as { summary: { violations: CruiseViolation[]; totalCruised?: number } };
}

function requireCruisedModules(output: unknown): {
  summary: { violations: CruiseViolation[]; totalCruised?: number };
} {
  const cruiseResult = requireCruiseResult(output);
  const total = cruiseResult.summary.totalCruised ?? 0;
  if (!Number.isInteger(total) || total < 1) {
    throw new GateError(
      "dependency-cruiser cruised 0 modules. Architecture cannot pass without a module graph.",
    );
  }
  return cruiseResult;
}

function ruleName(violation: CruiseViolation): string {
  if (violation.rule.name === "") {
    return "dependency-cruiser";
  }
  return violation.rule.name;
}

function findingFromViolation(violation: CruiseViolation): RuleFinding | undefined {
  if (violation.rule.severity !== "error") {
    return undefined;
  }
  const name = ruleName(violation);
  const extra = violation.comment === undefined || violation.comment === "" ? "" : ` ${violation.comment}`;
  return {
    kind: "rule",
    lane: "architecture",
    tool: "dependency-cruiser",
    rule: name,
    file: violation.from,
    line: 1,
    to: violation.to,
    message: `${name}: ${violation.from} -> ${violation.to}${extra}`,
  };
}

function requireArchConfig(configPath: string, cwd: string): string {
  const resolved = resolve(cwd, configPath);
  if (!existsSync(resolved)) {
    throw new GateError(
      `Architecture rule file not found: ${configPath}. Copy templates/architecture/layering.template.cjs and point architecture.config at it.`,
    );
  }
  return resolved;
}

function withoutReporter(options: ICruiseOptions): ICruiseOptions {
  const next = { ...options };
  delete next.outputType;
  return next;
}

function transpileFor(
  api: DepcruiseApi,
  options: ICruiseOptions,
  cwd: string,
): { tsConfig: unknown } | undefined {
  const tsName = options.tsConfig?.fileName;
  if (tsName === undefined || tsName === "") {
    return undefined;
  }
  return { tsConfig: api.extractTSConfig(resolve(cwd, tsName)) };
}

function findingsFromOutput(output: unknown): RuleFinding[] {
  const cruiseResult = requireCruisedModules(output);
  const findings: RuleFinding[] = [];
  for (const violation of cruiseResult.summary.violations) {
    const finding = findingFromViolation(violation);
    if (finding !== undefined) {
      findings.push(finding);
    }
  }
  return findings;
}

function wrapCruiseError(cause: unknown): never {
  if (cause instanceof GateError) {
    throw cause;
  }
  const message = cause instanceof Error ? cause.message : String(cause);
  throw new GateError(`dependency-cruiser failed: ${message}`, { cause });
}

async function cruiseTargets(
  targets: string[],
  resolved: string,
  cwd: string,
): Promise<RuleFinding[]> {
  const api = await loadDepcruise();
  try {
    const loaded = await api.extractDepcruiseOptions(resolved);
    const options = withoutReporter(loaded);
    const result = await api.cruise(targets, options, undefined, transpileFor(api, options, cwd));
    return findingsFromOutput(result.output);
  } catch (cause) {
    wrapCruiseError(cause);
  }
}

export async function runDepcruise(
  files: string[],
  configPath: string,
  cwd = process.cwd(),
): Promise<RuleFinding[]> {
  const targets = files.filter(isJsTsFile);
  if (targets.length === 0) {
    return [];
  }
  return cruiseTargets(targets, requireArchConfig(configPath, cwd), cwd);
}
