import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { GateError } from "./errors.js";
import type { AgentLintConfig, CliArgs, CyclomaticTool } from "./types.js";

export const DEFAULT_CYCLOMATIC_MAX = 10;
export const DEFAULT_COGNITIVE_MAX = 15;
export const DEFAULT_IGNORE = [
  "node_modules/**",
  "dist/**",
  "coverage/**",
  ".git/**",
];
export const DEFAULT_CYCLO_TOOLS: CyclomaticTool[] = ["lizard", "eslint"];
export const DEFAULT_ARCH_CONFIG = ".dependency-cruiser.cjs";

const CONFIG_CANDIDATES = [
  "agent-lint.config.json",
  ".agent-lintrc.json",
  ".agent-lintrc",
];

interface RawConfig {
  cyclomatic?: {
    max?: unknown;
    tools?: unknown;
  };
  cognitive?: {
    max?: unknown;
  };
  architecture?: {
    config?: unknown;
  };
  mutation?: {
    config?: unknown;
  };
  ignore?: unknown;
  agentLint?: RawConfig;
}

export function defaultConfig(): AgentLintConfig {
  return {
    cyclomatic: {
      max: DEFAULT_CYCLOMATIC_MAX,
      tools: [...DEFAULT_CYCLO_TOOLS],
    },
    cognitive: {
      max: DEFAULT_COGNITIVE_MAX,
    },
    architecture: {
      config: DEFAULT_ARCH_CONFIG,
    },
    ignore: [...DEFAULT_IGNORE],
  };
}

function assertPositiveInt(value: unknown, label: string): number {
  if (!Number.isInteger(value) || typeof value !== "number" || value < 1) {
    throw new GateError(`${label} must be a positive integer, got ${JSON.stringify(value)}`);
  }
  return value;
}

function parseTools(value: unknown): CyclomaticTool[] {
  if (value === undefined) {
    return [...DEFAULT_CYCLO_TOOLS];
  }
  if (!Array.isArray(value) || value.length === 0) {
    throw new GateError('cyclomatic.tools must be a non-empty array of "lizard" and/or "eslint"');
  }
  const tools: CyclomaticTool[] = [];
  for (const item of value) {
    if (item === "lizard" || item === "eslint") {
      if (!tools.includes(item)) {
        tools.push(item);
      }
      continue;
    }
    throw new GateError(`Unknown cyclomatic tool: ${JSON.stringify(item)}`);
  }
  return tools;
}

function parseArchitecture(value: unknown): { config: string } {
  if (value === undefined) {
    return { config: DEFAULT_ARCH_CONFIG };
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GateError("architecture must be an object");
  }
  const config = (value as { config?: unknown }).config;
  if (config === undefined) {
    return { config: DEFAULT_ARCH_CONFIG };
  }
  if (typeof config !== "string" || config.trim() === "") {
    throw new GateError("architecture.config must be a non-empty string");
  }
  return { config };
}

function parseMutation(value: unknown): { config: string } | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new GateError("mutation must be an object");
  }
  const config = (value as { config?: unknown }).config;
  if (typeof config !== "string" || config.trim() === "") {
    throw new GateError("mutation.config must be a non-empty string");
  }
  return { config };
}

function parseIgnore(value: unknown): string[] {
  if (value === undefined) {
    return [...DEFAULT_IGNORE];
  }
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new GateError("ignore must be an array of strings");
  }
  return value as string[];
}

export function parseConfigObject(raw: RawConfig): AgentLintConfig {
  const body = raw.agentLint ?? raw;
  return {
    cyclomatic: {
      max:
        body.cyclomatic?.max === undefined
          ? DEFAULT_CYCLOMATIC_MAX
          : assertPositiveInt(body.cyclomatic.max, "cyclomatic.max"),
      tools: parseTools(body.cyclomatic?.tools),
    },
    cognitive: {
      max:
        body.cognitive?.max === undefined
          ? DEFAULT_COGNITIVE_MAX
          : assertPositiveInt(body.cognitive.max, "cognitive.max"),
    },
    architecture: parseArchitecture(body.architecture),
    mutation: parseMutation(body.mutation),
    ignore: parseIgnore(body.ignore),
  };
}

export function parseConfigJson(text: string, source: string): AgentLintConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new GateError(`Invalid JSON in ${source}`, { cause });
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new GateError(`Config ${source} must be a JSON object`);
  }
  return parseConfigObject(parsed as RawConfig);
}

function readPackageAgentLint(cwd: string): AgentLintConfig | undefined {
  const pkgPath = resolve(cwd, "package.json");
  if (!existsSync(pkgPath)) {
    return undefined;
  }
  const parsed = JSON.parse(readFileSync(pkgPath, "utf8")) as RawConfig;
  if (parsed.agentLint === undefined) {
    return undefined;
  }
  return parseConfigObject({ agentLint: parsed.agentLint });
}

export function findConfigPath(cwd: string, explicit?: string): string | undefined {
  if (explicit !== undefined) {
    const resolved = resolve(cwd, explicit);
    if (!existsSync(resolved)) {
      throw new GateError(`Config file not found: ${explicit}`);
    }
    return resolved;
  }
  for (const name of CONFIG_CANDIDATES) {
    const candidate = resolve(cwd, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

export function loadConfig(args: CliArgs, cwd = process.cwd()): AgentLintConfig {
  const path = findConfigPath(cwd, args.configPath);
  let config = defaultConfig();
  if (path !== undefined) {
    config = parseConfigJson(readFileSync(path, "utf8"), path);
  } else {
    const fromPkg = readPackageAgentLint(cwd);
    if (fromPkg !== undefined) {
      config = fromPkg;
    }
  }
  if (args.maxCyclomatic !== undefined) {
    config.cyclomatic.max = args.maxCyclomatic;
  }
  if (args.maxCognitive !== undefined) {
    config.cognitive.max = args.maxCognitive;
  }
  return config;
}
