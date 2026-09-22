import { relative } from "node:path";
import { EXIT_ERROR, EXIT_FAIL, EXIT_PASS, type ExitCode } from "./exit.js";
import type { Finding, Format, Lane, LintReport, Thresholds } from "./types.js";
import { packageVersion } from "./version.js";

export function displayPath(file: string, cwd = process.cwd()): string {
  const rel = relative(cwd, file);
  if (rel === "" || rel.startsWith("..")) {
    return file;
  }
  return rel;
}

function formatFindingLine(finding: Finding, cwd: string): string {
  const file = displayPath(finding.file, cwd);
  const fn = finding.functionName ? `  ${finding.functionName}` : "";
  return `${file}:${finding.line}${fn}  ${finding.metric} ${finding.value} > ${finding.threshold}  [${finding.tool}]  ${finding.message}`;
}

export function formatHuman(report: LintReport, cwd = process.cwd()): string {
  const lines: string[] = [
    `agent-lint  (${report.lanes.join(" + ") || "none"})`,
    `cyclomatic max: ${report.thresholds.cyclomatic}`,
    `cognitive max: ${report.thresholds.cognitive}`,
    "",
  ];
  if (report.errors.length > 0) {
    for (const error of report.errors) {
      lines.push(`error: ${error}`);
    }
    lines.push("");
  }
  if (report.findings.length === 0 && report.exitCode === EXIT_PASS) {
    lines.push("0 finding(s). PASS");
    return `${lines.join("\n")}\n`;
  }
  for (const finding of report.findings) {
    lines.push(formatFindingLine(finding, cwd));
  }
  if (report.exitCode === EXIT_FAIL) {
    lines.push("");
    lines.push(`${report.findings.length} finding(s). FAIL`);
  } else if (report.exitCode === EXIT_ERROR) {
    lines.push("ERROR");
  }
  return `${lines.join("\n")}\n`;
}

export function formatJson(report: LintReport, cwd = process.cwd()): string {
  const body = {
    ok: report.ok,
    exitCode: report.exitCode,
    lanes: report.lanes,
    thresholds: report.thresholds,
    findings: report.findings.map((finding) => ({
      ...finding,
      file: displayPath(finding.file, cwd),
    })),
    errors: report.errors,
  };
  return `${JSON.stringify(body, null, 2)}\n`;
}

interface SarifResult {
  ruleId: string;
  level: "error" | "warning";
  message: { text: string };
  locations: Array<{
    physicalLocation: {
      artifactLocation: { uri: string };
      region: { startLine: number };
    };
  }>;
  properties: {
    lane: Lane;
    tool: string;
    metric: string;
    value: number;
    threshold: number;
    functionName?: string;
  };
}

function toSarifResult(finding: Finding, cwd: string): SarifResult {
  return {
    ruleId: finding.rule,
    level: "error",
    message: { text: finding.message },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: displayPath(finding.file, cwd) },
          region: { startLine: Math.max(finding.line, 1) },
        },
      },
    ],
    properties: {
      lane: finding.lane,
      tool: finding.tool,
      metric: finding.metric,
      value: finding.value,
      threshold: finding.threshold,
      functionName: finding.functionName,
    },
  };
}

export function formatSarif(report: LintReport, cwd = process.cwd()): string {
  const sarif = {
    $schema: "https://json.schemastore.org/sarif-2.1.0.json",
    version: "2.1.0",
    runs: [
      {
        tool: {
          driver: {
            name: "agent-lint",
            version: packageVersion(),
            informationUri: "https://github.com/terryyin/lizard",
            rules: [
              {
                id: "complexity",
                shortDescription: { text: "Cyclomatic complexity (ESLint + lizard)" },
              },
              {
                id: "sonarjs/cognitive-complexity",
                shortDescription: { text: "Cognitive complexity (eslint-plugin-sonarjs)" },
              },
              {
                id: "lizard/cyclomatic",
                shortDescription: { text: "Cyclomatic complexity (lizard)" },
              },
            ],
          },
        },
        results: report.findings.map((finding) => toSarifResult(finding, cwd)),
        invocations: [
          {
            executionSuccessful: report.exitCode !== EXIT_ERROR,
            exitCode: report.exitCode,
            exitCodeDescription: report.errors.join("; ") || undefined,
          },
        ],
      },
    ],
  };
  return `${JSON.stringify(sarif, null, 2)}\n`;
}

export function formatReport(report: LintReport, format: Format, cwd = process.cwd()): string {
  switch (format) {
    case "human":
      return formatHuman(report, cwd);
    case "json":
      return formatJson(report, cwd);
    case "sarif":
      return formatSarif(report, cwd);
    default: {
      const exhaustive: never = format;
      throw new Error(`Unknown format: ${String(exhaustive)}`);
    }
  }
}

export function reportFromError(
  message: string,
  lanes: Lane[],
  thresholds: Thresholds,
): LintReport {
  return {
    ok: false,
    exitCode: EXIT_ERROR,
    lanes,
    thresholds,
    findings: [],
    errors: [message],
  };
}

export function reportFromFindings(
  findings: Finding[],
  lanes: Lane[],
  thresholds: Thresholds,
): LintReport {
  const exitCode: ExitCode = findings.length > 0 ? EXIT_FAIL : EXIT_PASS;
  return {
    ok: exitCode === EXIT_PASS,
    exitCode,
    lanes,
    thresholds,
    findings,
    errors: [],
  };
}
