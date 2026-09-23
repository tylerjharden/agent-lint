import type { ExitCode } from "./exit.js";

export type Command = "complexity" | "cognitive" | "arch" | "mutation" | "perf" | "all";
export type Format = "human" | "json" | "sarif";
export type Lane = "complexity" | "cognitive" | "architecture" | "mutation" | "perf";
export type ToolName = "lizard" | "eslint" | "sonarjs" | "dependency-cruiser" | "stryker" | "vitest";
export type Metric = "cyclomatic" | "cognitive";
export type CyclomaticTool = "lizard" | "eslint";

export interface MetricFinding {
  kind: "metric";
  lane: "complexity" | "cognitive";
  tool: "lizard" | "eslint" | "sonarjs";
  rule: string;
  file: string;
  line: number;
  functionName?: string;
  metric: Metric;
  value: number;
  threshold: number;
  message: string;
}

export interface RuleFinding {
  kind: "rule";
  lane: "architecture";
  tool: "dependency-cruiser";
  rule: string;
  file: string;
  line: number;
  to?: string;
  message: string;
}

export interface ScoreFinding {
  kind: "score";
  lane: "mutation";
  tool: "stryker";
  rule: "mutation-score";
  file: string;
  line: number;
  value: number;
  threshold: number;
  killed?: number;
  survived?: number;
  noCoverage?: number;
  timeout?: number;
  message: string;
}

export interface TimingFinding {
  kind: "timing";
  lane: "perf";
  tool: "vitest";
  rule: "perf-regression";
  file: string;
  line: number;
  bench: string;
  value: number;
  baseline: number;
  threshold: number;
  hz?: number;
  message: string;
}

export type Finding = MetricFinding | RuleFinding | ScoreFinding | TimingFinding;

export interface Thresholds {
  cyclomatic: number;
  cognitive: number;
  mutation?: number;
  perf?: number;
}

export interface LintReport {
  ok: boolean;
  exitCode: ExitCode;
  lanes: Lane[];
  thresholds: Thresholds;
  findings: Finding[];
  errors: string[];
}

export interface AgentLintConfig {
  cyclomatic: {
    max: number;
    tools: CyclomaticTool[];
  };
  cognitive: {
    max: number;
  };
  architecture: {
    config: string;
  };
  mutation?: {
    config: string;
  };
  perf?: {
    config: string;
  };
  ignore: string[];
}

export interface CliArgs {
  command: Command;
  paths: string[];
  format: Format;
  configPath?: string;
  stdin: boolean;
  stdinCode: boolean;
  stdinFilePath: string;
  maxCyclomatic?: number;
  maxCognitive?: number;
  help: boolean;
  version: boolean;
}
