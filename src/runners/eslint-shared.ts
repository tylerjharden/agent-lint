import { ESLint, type Linter } from "eslint";
import tsParser from "@typescript-eslint/parser";
import { isJsTsFile } from "../extensions.js";
import { GateError } from "../errors.js";
import type { Finding, Lane, Metric, ToolName } from "../types.js";

export function jsTsOnly(files: string[]): string[] {
  return files.filter(isJsTsFile);
}

export function baseLanguageOptions(): Linter.Config["languageOptions"] {
  return {
    parser: tsParser,
    ecmaVersion: 2022,
    sourceType: "module",
  };
}

export async function lintFiles(
  files: string[],
  config: Linter.Config,
): Promise<ESLint.LintResult[]> {
  const targets = jsTsOnly(files);
  if (targets.length === 0) {
    return [];
  }
  try {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: config,
      errorOnUnmatchedPattern: false,
      allowInlineConfig: false,
    });
    return await eslint.lintFiles(targets);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new GateError(`ESLint failed: ${message}`, { cause });
  }
}

export async function lintText(
  code: string,
  filePath: string,
  config: Linter.Config,
): Promise<ESLint.LintResult[]> {
  try {
    const eslint = new ESLint({
      overrideConfigFile: true,
      overrideConfig: config,
      allowInlineConfig: false,
    });
    return await eslint.lintText(code, { filePath });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    throw new GateError(`ESLint failed: ${message}`, { cause });
  }
}

export function firstNumber(message: string, pattern: RegExp, fallback: number): number {
  const match = pattern.exec(message);
  const raw = match?.[1];
  if (raw === undefined) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

export function functionNameFromMessage(message: string): string | undefined {
  const match = /(?:Function|Method|Arrow function) '([^']+)'/.exec(message);
  return match?.[1];
}

export function findingFromMessage(opts: {
  file: string;
  line: number;
  message: string;
  rule: string;
  lane: Lane;
  tool: ToolName;
  metric: Metric;
  value: number;
  threshold: number;
  functionName?: string;
}): Finding {
  return {
    lane: opts.lane,
    tool: opts.tool,
    rule: opts.rule,
    file: opts.file,
    line: opts.line,
    functionName: opts.functionName,
    metric: opts.metric,
    value: opts.value,
    threshold: opts.threshold,
    message: opts.message,
  };
}

export function collectRuleMessages(
  results: ESLint.LintResult[],
  ruleId: string,
): Array<{ file: string; line: number; message: string }> {
  const out: Array<{ file: string; line: number; message: string }> = [];
  for (const result of results) {
    for (const msg of result.messages) {
      if (msg.ruleId === ruleId) {
        out.push({
          file: result.filePath,
          line: msg.line,
          message: msg.message,
        });
      }
    }
    if (result.fatalErrorCount > 0) {
      const fatal = result.messages.find((msg) => msg.fatal);
      throw new GateError(
        `ESLint fatal error in ${result.filePath}: ${fatal?.message ?? "unknown parse error"}`,
      );
    }
  }
  return out;
}
