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
import { loadSonarjsPlugin } from "./load-sonarjs.js";

const RULE = "sonarjs/cognitive-complexity";

async function cognitiveConfig(threshold: number): Promise<Linter.Config> {
  const sonarjs = await loadSonarjsPlugin();
  return {
    files: ["**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}"],
    languageOptions: baseLanguageOptions(),
    plugins: { sonarjs },
    rules: {
      [RULE]: ["error", threshold],
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
      rule: RULE,
      lane: "cognitive",
      tool: "sonarjs",
      metric: "cognitive",
      value: firstNumber(row.message, /Cognitive Complexity from (\d+)/i, threshold + 1),
      threshold: firstNumber(row.message, /to the (\d+) allowed/i, threshold),
      functionName: functionNameFromMessage(row.message),
    }),
  );
}

export async function runEslintCognitive(
  files: string[],
  threshold: number,
): Promise<Finding[]> {
  const results = await lintFiles(files, await cognitiveConfig(threshold));
  return toFindings(collectRuleMessages(results, RULE), threshold);
}

export async function runEslintCognitiveText(
  code: string,
  filePath: string,
  threshold: number,
): Promise<Finding[]> {
  const results = await lintText(code, filePath, await cognitiveConfig(threshold));
  return toFindings(collectRuleMessages(results, RULE), threshold);
}
