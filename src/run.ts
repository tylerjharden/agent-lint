import { resolve } from "node:path";
import { collectFromPaths, parsePathList } from "./collect-paths.js";
import type { AgentLintConfig, CliArgs, Finding, Lane, LintReport, Thresholds } from "./types.js";
import { GateError } from "./errors.js";
import { isJsTsFile, isLizardFile } from "./extensions.js";
import { lanesFor, loadConfigured, microConfigured, mutationConfigured, perfConfigured } from "./lanes.js";
import { reportFromFindings } from "./report.js";
import { runDepcruise } from "./runners/depcruise.js";
import { runEslintCognitive, runEslintCognitiveText } from "./runners/eslint-cognitive.js";
import { runEslintComplexity, runEslintComplexityText } from "./runners/eslint-complexity.js";
import { runLizard } from "./runners/lizard.js";
import { runStryker } from "./runners/stryker.js";
import { runArtillery } from "./runners/artillery.js";
import { runVitestBench } from "./runners/vitest-bench.js";
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

function usesPerf(lanes: Lane[]): boolean {
  return lanes.includes("perf");
}

const STDIN_CODE_BLOCKED: Partial<Record<CliArgs["command"], string>> = {
  arch: "arch does not accept --stdin-code. Architecture runs on files on disk.",
  mutation: "mutation does not accept --stdin-code. Mutation runs on files on disk.",
  perf: "perf does not accept --stdin-code. Micro-bench and load/soak run on files on disk.",
};

function rejectStdinCodeCommand(args: CliArgs): void {
  if (!args.stdinCode) {
    return;
  }
  const message = STDIN_CODE_BLOCKED[args.command];
  if (message !== undefined) {
    throw new GateError(message);
  }
}

function skipOnStdinCode(lane: Lane): boolean {
  return lane === "architecture" || lane === "mutation" || lane === "perf";
}

function lanesForThisRun(args: CliArgs, config: AgentLintConfig): Lane[] {
  rejectStdinCodeCommand(args);
  rejectPerfSubflags(args);
  const lanes = lanesFor(args.command, {
    mutation: mutationConfigured(config),
    perf: perfConfigured(config),
  });
  if (!args.stdinCode) {
    return lanes;
  }
  return lanes.filter((lane) => !skipOnStdinCode(lane));
}

function requireOptionalLaneConfig(
  value: { config: string } | undefined,
  missing: string,
): string {
  if (value === undefined) {
    throw new GateError(missing);
  }
  return value.config;
}

function requireMutationConfig(config: AgentLintConfig): string {
  return requireOptionalLaneConfig(
    config.mutation,
    "Mutation config is not set. Set mutation.config to a native Stryker file. Copy templates/mutation/stryker.config.json and point mutation.config at the copy.",
  );
}

function requireLoadConfig(config: AgentLintConfig): string {
  return requireOptionalLaneConfig(
    config.perf?.load === undefined ? undefined : { config: config.perf.load },
    "Load/soak config is not set. Set perf.load (or perf.config) to an Artillery glue file. Copy templates/perf/perf.config.json and point perf.load at the copy. Load/soak is a Perf lock.",
  );
}

function requireMicroConfig(config: AgentLintConfig): string {
  return requireOptionalLaneConfig(
    config.perf?.micro === undefined ? undefined : { config: config.perf.micro },
    "Micro-bench config is not set. Set perf.micro to a Vitest glue file. Copy templates/micro/micro.config.json and point perf.micro at the copy. Micro-bench is a Perf lock. Hyperfine is an allowed alternate micro runner; this wrap ships Vitest.",
  );
}

function rejectPerfSubflags(args: CliArgs): void {
  if ((args.micro || args.load) && args.command !== "perf") {
    throw new GateError("--micro and --load are only valid with the perf command.");
  }
}

function wantMicro(args: CliArgs, config: AgentLintConfig): boolean {
  if (args.micro) {
    return true;
  }
  if (args.load) {
    return false;
  }
  return microConfigured(config);
}

function wantLoad(args: CliArgs, config: AgentLintConfig): boolean {
  if (args.load) {
    return true;
  }
  if (args.micro) {
    return false;
  }
  return loadConfigured(config);
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
    usesMutation(lanes) ||
    usesPerf(lanes);
  if (!anyTool) {
    throw new GateError("No lanes/tools enabled for this run.");
  }
}

async function runOnFiles(
  files: string[],
  config: AgentLintConfig,
  lanes: Lane[],
  cwd: string,
  args: CliArgs,
): Promise<{
  findings: Finding[];
  mutationBreak?: number;
  loadRegression?: number;
  microRegression?: number;
}> {
  assertLaneFiles(files, config, lanes);
  assertToolsEnabled(files, config, lanes);
  const findings: Finding[] = [];
  let mutationBreak: number | undefined;
  let loadRegression: number | undefined;
  let microRegression: number | undefined;
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
  if (usesPerf(lanes)) {
    const runMicro = wantMicro(args, config);
    const runLoad = wantLoad(args, config);
    if (!runMicro && !runLoad) {
      throw new GateError(
        "Perf config is not set. Set perf.micro (Vitest micro-bench) and/or perf.load (Artillery load/soak). Copy templates/micro/ or templates/perf/. Both sub-lanes are Perf locks.",
      );
    }
    if (runMicro) {
      const micro = await runVitestBench(requireMicroConfig(config), cwd);
      findings.push(...micro.findings);
      microRegression = micro.maxRegression;
    }
    if (runLoad) {
      const load = await runArtillery(requireLoadConfig(config), cwd);
      findings.push(...load.findings);
      loadRegression = load.maxRegression;
    }
  }
  return { findings, mutationBreak, loadRegression, microRegression };
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
  extras: { mutationBreak?: number; loadRegression?: number; microRegression?: number },
): Thresholds {
  const thresholds: Thresholds = {
    cyclomatic: config.cyclomatic.max,
    cognitive: config.cognitive.max,
  };
  if (extras.mutationBreak !== undefined) {
    thresholds.mutation = extras.mutationBreak;
  }
  if (extras.loadRegression !== undefined) {
    thresholds.load = extras.loadRegression;
  }
  if (extras.microRegression !== undefined) {
    thresholds.micro = extras.microRegression;
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
    return reportFromFindings(findings, lanes, thresholdsFrom(config, {}));
  }

  const files = collectFromPaths(resolvePathArgs(args, stdinText), cwd, config.ignore);
  if (files.length === 0) {
    throw new GateError("No supported source files found after applying ignore patterns.");
  }

  const result = await runOnFiles(files, config, lanes, cwd, args);
  return reportFromFindings(
    result.findings,
    lanes,
    thresholdsFrom(config, {
      mutationBreak: result.mutationBreak,
      loadRegression: result.loadRegression,
      microRegression: result.microRegression,
    }),
  );
}
