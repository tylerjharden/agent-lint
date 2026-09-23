import { resolve } from "node:path";
import { collectFromPaths, parsePathList } from "./collect-paths.js";
import type { AgentLintConfig, CliArgs, Finding, Lane, LintReport } from "./types.js";
import { GateError } from "./errors.js";
import { isJsTsFile, isLizardFile } from "./extensions.js";
import { lanesFor } from "./lanes.js";
import { reportFromFindings } from "./report.js";
import { runDepcruise } from "./runners/depcruise.js";
import { runEslintCognitive, runEslintCognitiveText } from "./runners/eslint-cognitive.js";
import { runEslintComplexity, runEslintComplexityText } from "./runners/eslint-complexity.js";
import { runLizard } from "./runners/lizard.js";
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

function assertArchAllowsStdinCode(config: AgentLintConfig, lanes: Lane[]): void {
  if (!usesArchitecture(lanes)) {
    return;
  }
  const otherLane =
    usesLizard(config, lanes) || usesEslintCyclo(config, lanes) || usesCognitive(lanes);
  if (!otherLane) {
    throw new GateError(
      "architecture lane needs files on disk (a module graph), not --stdin-code",
    );
  }
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
    usesArchitecture(lanes);
  if (!anyTool) {
    throw new GateError("No lanes/tools enabled for this run.");
  }
}

async function runOnFiles(
  files: string[],
  config: AgentLintConfig,
  lanes: Lane[],
): Promise<Finding[]> {
  assertLaneFiles(files, config, lanes);
  assertToolsEnabled(files, config, lanes);
  const findings: Finding[] = [];
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
    findings.push(...(await runDepcruise(files, config.architecture.config)));
  }
  return findings;
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
  assertArchAllowsStdinCode(config, lanes);
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

export async function runLint(
  args: CliArgs,
  config: AgentLintConfig,
  stdinText: string | undefined,
  cwd = process.cwd(),
): Promise<LintReport> {
  const lanes = lanesFor(args.command);
  const thresholds = {
    cyclomatic: config.cyclomatic.max,
    cognitive: config.cognitive.max,
  };

  if (args.stdinCode) {
    if (stdinText === undefined) {
      throw new GateError("--stdin-code was set but stdin was empty");
    }
    const findings = await runOnStdinCode(stdinText, args.stdinFilePath, config, lanes);
    return reportFromFindings(findings, lanes, thresholds);
  }

  const files = collectFromPaths(resolvePathArgs(args, stdinText), cwd, config.ignore);
  if (files.length === 0) {
    throw new GateError("No supported source files found after applying ignore patterns.");
  }

  const findings = await runOnFiles(files, config, lanes);
  return reportFromFindings(findings, lanes, thresholds);
}
