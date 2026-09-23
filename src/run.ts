import { resolve } from "node:path";
import { collectFromPaths, parsePathList } from "./collect-paths.js";
import type { AgentLintConfig, CliArgs, Finding, Lane, LintReport, Thresholds } from "./types.js";
import { GateError } from "./errors.js";
import { isJsTsFile, isLizardFile } from "./extensions.js";
import { lanesFor, mutationConfigured } from "./lanes.js";
import { reportFromFindings } from "./report.js";
import { runDepcruise } from "./runners/depcruise.js";
import { runEslintCognitive, runEslintCognitiveText } from "./runners/eslint-cognitive.js";
import { runEslintComplexity, runEslintComplexityText } from "./runners/eslint-complexity.js";
import { runLizard } from "./runners/lizard.js";
import { runStryker } from "./runners/stryker.js";
import { writeTempSource } from "./temp-source.js";

function usesLizard(config: AgentLintConfig, lanes: Lane[]): boolean {
  return lanes.includes("complexity") && config.cyclomatic.tools.includes("lizard");
}

function usesEslintCyclo(config: AgentLintConfig, lanes: Lane[]): boolean {
  return lanes.includes("complexity") && config.cyclomatic.tools.includes("eslint");
}

function usesCognitive(lanes: Lane[]): boolean {
  return lanes.includes("cognitive");
}

function usesArchitecture(lanes: Lane[]): boolean {
  return lanes.includes("architecture");
}

function usesMutation(lanes: Lane[]): boolean {
  return lanes.includes("mutation");
}

function lanesForThisRun(args: CliArgs, config: AgentLintConfig): Lane[] {
  if (args.stdinCode && args.command === "arch") {
    throw new GateError(
      "arch does not accept --stdin-code. Architecture runs on files on disk.",
    );
  }
  if (args.stdinCode && args.command === "mutation") {
    throw new GateError(
      "mutation does not accept --stdin-code. Mutation runs on files on disk.",
    );
  }
  const lanes = lanesFor(args.command, mutationConfigured(config));
  if (!args.stdinCode) {
    return lanes;
  }
  return lanes.filter((lane) => lane !== "architecture" && lane !== "mutation");
}

function requireMutationConfig(config: AgentLintConfig): string {
  if (config.mutation === undefined) {
    throw new GateError(
      "Mutation config is not set. Set mutation.config to a native Stryker file. Copy templates/mutation/stryker.config.json and point mutation.config at the copy.",
    );
  }
  return config.mutation.config;
}

function requireJsTs(filePath: string, abs: string, lane: string): void {
  if (isJsTsFile(abs) || isJsTsFile(filePath)) {
    return;
  }
  throw new GateError(
    `--stdin-code with ${lane} requires a JS/TS --stdin-file-path (got ${filePath})`,
  );
}

function assertLaneFiles(files: string[], config: AgentLintConfig, lanes: Lane[]): void {
  const hasJsTs = files.some(isJsTsFile);
  if (lanes.includes("cognitive") && !hasJsTs) {
    throw new GateError(
      "cognitive lane requires JavaScript or TypeScript files (eslint-plugin-sonarjs). No JS/TS files in the input set.",
    );
  }
  if (lanes.includes("complexity") && !usesLizard(config, lanes) && !hasJsTs) {
    throw new GateError(
      "complexity lane has no applicable files (need JS/TS for ESLint, or install/enable lizard for other languages).",
    );
  }
  if (lanes.includes("architecture") && !hasJsTs) {
    throw new GateError(
      "architecture lane requires JavaScript or TypeScript files (dependency-cruiser). No JS/TS files in the input set.",
    );
  }
}

function assertToolsEnabled(files: string[], config: AgentLintConfig, lanes: Lane[]): void {
  const hasSource = files.some(isLizardFile) || files.some(isJsTsFile);
  if (!hasSource) {
    throw new GateError("No supported source files found.");
  }
  const anyTool =
    usesLizard(config, lanes) ||
    usesEslintCyclo(config, lanes) ||
    usesCognitive(lanes) ||
    usesArchitecture(lanes) ||
    usesMutation(lanes);
  if (!anyTool) {
    throw new GateError("No lanes/tools enabled for this run.");
  }
}

async function runOnFiles(
  files: string[],
  config: AgentLintConfig,
  lanes: Lane[],
  cwd: string,
): Promise<{ findings: Finding[]; mutationBreak?: number }> {
  assertLaneFiles(files, config, lanes);
  assertToolsEnabled(files, config, lanes);
  const findings: Finding[] = [];
  let mutationBreak: number | undefined;
  if (usesLizard(config, lanes)) {
    findings.push(...runLizard(files, config.cyclomatic.max));
  }
  if (usesEslintCyclo(config, lanes)) {
    findings.push(...(await runEslintComplexity(files, config.cyclomatic.max)));
  }
  if (usesCognitive(lanes)) {
    findings.push(...(await runEslintCognitive(files, config.cognitive.max)));
  }
  if (usesArchitecture(lanes)) {
    findings.push(...(await runDepcruise(files, config.architecture.config, cwd)));
  }
  if (usesMutation(lanes)) {
    const mutation = await runStryker(requireMutationConfig(config), cwd);
    findings.push(...mutation.findings);
    if (mutation.breakThreshold !== null) {
      mutationBreak = mutation.breakThreshold;
    }
  }
  return { findings, mutationBreak };
}

async function runEslintOnText(
  code: string,
  filePath: string,
  abs: string,
  config: AgentLintConfig,
  lanes: Lane[],
): Promise<Finding[]> {
  const findings: Finding[] = [];
  if (usesEslintCyclo(config, lanes)) {
    requireJsTs(filePath, abs, "ESLint complexity");
    findings.push(...(await runEslintComplexityText(code, abs, config.cyclomatic.max)));
  }
  if (usesCognitive(lanes)) {
    requireJsTs(filePath, abs, "cognitive");
    findings.push(...(await runEslintCognitiveText(code, abs, config.cognitive.max)));
  }
  return findings;
}

async function runOnStdinCode(
  code: string,
  filePath: string,
  config: AgentLintConfig,
  lanes: Lane[],
): Promise<Finding[]> {
  const abs = resolve(filePath);
  const temp = usesLizard(config, lanes) ? writeTempSource(code, filePath) : undefined;
  try {
    const fromLizard = temp === undefined ? [] : runLizard([temp.filePath], config.cyclomatic.max);
    const fromEslint = await runEslintOnText(code, filePath, abs, config, lanes);
    return [...fromLizard, ...fromEslint];
  } finally {
    temp?.cleanup();
  }
}

function resolvePathArgs(args: CliArgs, stdinText: string | undefined): string[] {
  const paths = [...args.paths];
  if (args.stdin) {
    if (stdinText === undefined) {
      throw new GateError("--stdin was set but stdin was empty");
    }
    paths.push(...parsePathList(stdinText));
  }
  if (paths.length === 0) {
    throw new GateError("No paths given. Pass files/directories or pipe paths on stdin.");
  }
  return paths;
}

function thresholdsFrom(
  config: AgentLintConfig,
  mutationBreak: number | undefined,
): Thresholds {
  const thresholds: Thresholds = {
    cyclomatic: config.cyclomatic.max,
    cognitive: config.cognitive.max,
  };
  if (mutationBreak !== undefined) {
    thresholds.mutation = mutationBreak;
  }
  return thresholds;
}

export async function runLint(
  args: CliArgs,
  config: AgentLintConfig,
  stdinText: string | undefined,
  cwd = process.cwd(),
): Promise<LintReport> {
  const lanes = lanesForThisRun(args, config);

  if (args.stdinCode) {
    if (stdinText === undefined) {
      throw new GateError("--stdin-code was set but stdin was empty");
    }
    const findings = await runOnStdinCode(stdinText, args.stdinFilePath, config, lanes);
    return reportFromFindings(findings, lanes, thresholdsFrom(config, undefined));
  }

  const files = collectFromPaths(resolvePathArgs(args, stdinText), cwd, config.ignore);
  if (files.length === 0) {
    throw new GateError("No supported source files found after applying ignore patterns.");
  }

  const result = await runOnFiles(files, config, lanes, cwd);
  return reportFromFindings(result.findings, lanes, thresholdsFrom(config, result.mutationBreak));
}
