import type { ExitCode } from "./exit.js";

export type Command = "complexity" | "cognitive" | "arch" | "all";
export type Format = "human" | "json" | "sarif";
export type Lane = "complexity" | "cognitive" | "architecture";
export type ToolName = "lizard" | "eslint" | "sonarjs" | "dependency-cruiser";
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

export type Finding = MetricFinding | RuleFinding;

export interface Thresholds {
  cyclomatic: number;
  cognitive: number;
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
