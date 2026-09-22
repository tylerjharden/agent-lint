import { resolve } from "node:path";
import { collectFromPaths, parsePathList } from "./collect-paths.js";
import type { AgentLintConfig, CliArgs, Finding, Lane, LintReport } from "./types.js";
import { GateError } from "./errors.js";
import { isJsTsFile, isLizardFile } from "./extensions.js";
import { lanesFor } from "./lanes.js";
import { reportFromFindings } from "./report.js";
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

function assertApplicable(
  files: string[],
  config: AgentLintConfig,
  lanes: Lane[],
): void {
  const hasJsTs = files.some(isJsTsFile);
  const hasLizard = files.some(isLizardFile);
  const lizardOn = usesLizard(config, lanes);
  const eslintOn = usesEslintCyclo(config, lanes);
  const cogOn = usesCognitive(lanes);

  if (lanes.includes("cognitive") && !hasJsTs) {
    throw new GateError(
      "cognitive lane requires JavaScript or TypeScript files (eslint-plugin-sonarjs). No JS/TS files in the input set.",
    );
  }
  if (lanes.includes("complexity") && !lizardOn && !hasJsTs) {
    throw new GateError(
      "complexity lane has no applicable files (need JS/TS for ESLint, or install/enable lizard for other languages).",
    );
  }
  if (!hasLizard && !hasJsTs) {
    throw new GateError("No supported source files found.");
  }
  if (!lizardOn && !eslintOn && !cogOn) {
    throw new GateError("No lanes/tools enabled for this run.");
  }
}

async function runOnFiles(
  files: string[],
  config: AgentLintConfig,
  lanes: Lane[],
): Promise<Finding[]> {
  assertApplicable(files, config, lanes);
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
  return findings;
}

async function runOnStdinCode(
  code: string,
  filePath: string,
  config: AgentLintConfig,
  lanes: Lane[],
): Promise<Finding[]> {
  const findings: Finding[] = [];
  const abs = resolve(filePath);
  const needsLizard = usesLizard(config, lanes);
  let temp: ReturnType<typeof writeTempSource> | undefined;
  try {
    if (needsLizard) {
      temp = writeTempSource(code, filePath);
      findings.push(...runLizard([temp.filePath], config.cyclomatic.max));
    }
    if (usesEslintCyclo(config, lanes)) {
      if (!isJsTsFile(abs) && !isJsTsFile(filePath)) {
        throw new GateError(
          `--stdin-code with ESLint complexity requires a JS/TS --stdin-file-path (got ${filePath})`,
        );
      }
      findings.push(
        ...(await runEslintComplexityText(code, abs, config.cyclomatic.max)),
      );
    }
    if (usesCognitive(lanes)) {
      if (!isJsTsFile(abs) && !isJsTsFile(filePath)) {
        throw new GateError(
          `--stdin-code with cognitive requires a JS/TS --stdin-file-path (got ${filePath})`,
        );
      }
      findings.push(...(await runEslintCognitiveText(code, abs, config.cognitive.max)));
    }
  } finally {
    temp?.cleanup();
  }
  return findings;
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

  const files = collectFromPaths(paths, cwd, config.ignore);
  if (files.length === 0) {
    throw new GateError("No supported source files found after applying ignore patterns.");
  }

  const findings = await runOnFiles(files, config, lanes);
  return reportFromFindings(findings, lanes, thresholds);
}
