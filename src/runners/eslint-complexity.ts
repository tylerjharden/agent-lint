import type { Linter } from "eslint";
import type { Finding } from "../types.js";
import {
  baseLanguageOptions,
  collectRuleMessages,
  findingFromMessage,
  firstNumber,
  functionNameFromMessage,
  lintFiles,
  lintText,
} from "./eslint-shared.js";

function complexityConfig(threshold: number): Linter.Config {
  return {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
    languageOptions: baseLanguageOptions(),
    rules: {
      complexity: ["error", threshold],
    },
  };
}

function toFindings(
  rows: Array<{ file: string; line: number; message: string }>,
  threshold: number,
): Finding[] {
  return rows.map((row) =>
    findingFromMessage({
      file: row.file,
      line: row.line,
      message: row.message,
      rule: "complexity",
      lane: "complexity",
      tool: "eslint",
      metric: "cyclomatic",
      value: firstNumber(row.message, /complexity of (\d+)/i, threshold + 1),
      threshold,
      functionName: functionNameFromMessage(row.message),
    }),
  );
}

export async function runEslintComplexity(
  files: string[],
  threshold: number,
): Promise<Finding[]> {
  const results = await lintFiles(files, complexityConfig(threshold));
  return toFindings(collectRuleMessages(results, "complexity"), threshold);
}

export async function runEslintComplexityText(
  code: string,
  filePath: string,
  threshold: number,
): Promise<Finding[]> {
  const results = await lintText(code, filePath, complexityConfig(threshold));
  return toFindings(collectRuleMessages(results, "complexity"), threshold);
}
