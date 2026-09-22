import type { ExitCode } from "./exit.js";

export type Command = "complexity" | "cognitive" | "all";
export type Format = "human" | "json" | "sarif";
export type Lane = "complexity" | "cognitive";
export type ToolName = "lizard" | "eslint" | "sonarjs";
export type Metric = "cyclomatic" | "cognitive";
export type CyclomaticTool = "lizard" | "eslint";

export interface Finding {
  lane: Lane;
  tool: ToolName;
  rule: string;
  file: string;
  line: number;
  functionName?: string;
  metric: Metric;
  value: number;
  threshold: number;
  message: string;
}

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
