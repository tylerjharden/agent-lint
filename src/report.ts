import { relative } from "node:path";
import { EXIT_ERROR, EXIT_FAIL, EXIT_PASS, type ExitCode } from "./exit.js";
import type {
  Finding,
  Format,
  Lane,
  LintReport,
  MetricFinding,
  RuleFinding,
  ScoreFinding,
  Thresholds,
  TimingFinding,
} from "./types.js";
import { packageVersion } from "./version.js";

export function displayPath(file: string, cwd = process.cwd()): string {
  const rel = relative(cwd, file);
  if (rel === "" || rel.startsWith("..")) {
    return file;
  }
  return rel;
}

function formatMetricLine(finding: MetricFinding, cwd: string): string {
  const file = displayPath(finding.file, cwd);
  const fn = finding.functionName ? `  ${finding.functionName}` : "";
  return `${file}:${finding.line}${fn}  ${finding.metric} ${finding.value} > ${finding.threshold}  [${finding.tool}]  ${finding.message}`;
}

function formatRuleLine(finding: RuleFinding, cwd: string): string {
  const file = displayPath(finding.file, cwd);
  const to = finding.to === undefined ? "" : displayPath(finding.to, cwd);
  return `${file}:${finding.line}  → ${to}  [${finding.tool}]  ${finding.rule}  ${finding.message}`;
}

function formatScoreLine(finding: ScoreFinding, cwd: string): string {
  const file = displayPath(finding.file, cwd);
  return `${file}:${finding.line}  mutation-score ${finding.value} < ${finding.threshold}  [${finding.tool}]  ${finding.message}`;
}

function formatTimingLine(finding: TimingFinding, cwd: string): string {
  const file = displayPath(finding.file, cwd);
  switch (finding.tool) {
    case "artillery":
      return `${file}:${finding.line}  p95 ${finding.value} > ${finding.threshold}  [artillery]  ${finding.message}`;
    case "vitest":
      return `${file}:${finding.line}  ${finding.bench ?? "bench"} mean ${finding.value} > ${finding.threshold}  [vitest]  ${finding.message}`;
    default: {
      const exhaustive: never = finding.tool;
      throw new Error(`Unknown timing tool: ${String(exhaustive)}`);
    }
  }
}

function formatFindingLine(finding: Finding, cwd: string): string {
  switch (finding.kind) {
    case "metric":
      return formatMetricLine(finding, cwd);
    case "rule":
      return formatRuleLine(finding, cwd);
    case "score":
      return formatScoreLine(finding, cwd);
    case "timing":
      return formatTimingLine(finding, cwd);
    default: {
      const exhaustive: never = finding;
      throw new Error(`Unknown finding: ${String(exhaustive)}`);
    }
  }
}

function humanHeader(report: LintReport): string[] {
  const lines = [
    `agent-lint  (${report.lanes.join(" + ") || "none"})`,
    `cyclomatic max: ${report.thresholds.cyclomatic}`,
    `cognitive max: ${report.thresholds.cognitive}`,
  ];
  if (report.lanes.includes("architecture")) {
    lines.push("architecture: dependency-cruiser");
  }
  if (report.lanes.includes("mutation")) {
    const breakAt = report.thresholds.mutation;
    lines.push(
      breakAt === undefined ? "mutation: stryker" : `mutation break: ${breakAt}`,
    );
  }
  if (report.lanes.includes("perf")) {
    lines.push(perfHeaderLine(report.thresholds));
  }
  lines.push("");
  return lines;
}

function perfHeaderLine(thresholds: Thresholds): string {
  const parts: string[] = [];
  if (thresholds.micro !== undefined) {
    parts.push(`micro maxRegression: ${thresholds.micro}`);
  }
  if (thresholds.load !== undefined) {
    parts.push(`load p95 maxRegression: ${thresholds.load}`);
  }
  if (parts.length === 0) {
    return "perf: micro-bench + load/soak";
  }
  return `perf ${parts.join("; ")}`;
}

function appendErrors(lines: string[], errors: string[]): void {
  if (errors.length === 0) {
    return;
  }
  for (const error of errors) {
    lines.push(`error: ${error}`);
  }
  lines.push("");
}

function humanFooter(report: LintReport): string | undefined {
  if (report.exitCode === EXIT_FAIL) {
    return `${report.findings.length} finding(s). FAIL`;
  }
  if (report.exitCode === EXIT_ERROR) {
    return "ERROR";
  }
  return undefined;
}

export function formatHuman(report: LintReport, cwd = process.cwd()): string {
  const lines = humanHeader(report);
  appendErrors(lines, report.errors);
  if (report.findings.length === 0 && report.exitCode === EXIT_PASS) {
    lines.push("0 finding(s). PASS");
    return `${lines.join("\n")}\n`;
  }
  for (const finding of report.findings) {
    lines.push(formatFindingLine(finding, cwd));
  }
  const footer = humanFooter(report);
  if (footer !== undefined) {
    lines.push("");
    lines.push(footer);
  }
  return `${lines.join("\n")}\n`;
}

function findingForJson(finding: Finding, cwd: string): Finding {
  switch (finding.kind) {
    case "metric":
      return { ...finding, file: displayPath(finding.file, cwd) };
    case "rule":
      return {
        ...finding,
        file: displayPath(finding.file, cwd),
        to: finding.to === undefined ? undefined : displayPath(finding.to, cwd),
      };
    case "score":
      return { ...finding, file: displayPath(finding.file, cwd) };
    case "timing":
      return { ...finding, file: displayPath(finding.file, cwd) };
    default: {
      const exhaustive: never = finding;
      throw new Error(`Unknown finding: ${String(exhaustive)}`);
    }
  }
}

export function formatJson(report: LintReport, cwd = process.cwd()): string {
  const body = {
    ok: report.ok,
    exitCode: report.exitCode,
    lanes: report.lanes,
    thresholds: report.thresholds,
    findings: report.findings.map((finding) => findingForJson(finding, cwd)),
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
    kind: "metric" | "rule" | "score" | "timing";
    metric?: string;
    value?: number;
    threshold?: number;
    functionName?: string;
    to?: string;
    rule?: string;
    killed?: number;
    survived?: number;
    noCoverage?: number;
    timeout?: number;
    bench?: string;
    baseline?: number;
    hz?: number;
    gate?: string;
  };
}

function sarifRuleId(finding: Finding): string {
  switch (finding.kind) {
    case "metric":
      return finding.rule;
    case "rule":
      return "dependency-cruiser";
    case "score":
      return "mutation-score";
    case "timing":
      return finding.rule;
    default: {
      const exhaustive: never = finding;
      throw new Error(`Unknown finding: ${String(exhaustive)}`);
    }
  }
}

function sarifProperties(finding: Finding, cwd: string): SarifResult["properties"] {
  switch (finding.kind) {
    case "metric":
      return {
        lane: finding.lane,
        tool: finding.tool,
        kind: "metric",
        metric: finding.metric,
        value: finding.value,
        threshold: finding.threshold,
        functionName: finding.functionName,
      };
    case "rule":
      return {
        lane: finding.lane,
        tool: finding.tool,
        kind: "rule",
        rule: finding.rule,
        to: finding.to === undefined ? undefined : displayPath(finding.to, cwd),
      };
    case "score":
      return {
        lane: finding.lane,
        tool: finding.tool,
        kind: "score",
        rule: finding.rule,
        value: finding.value,
        threshold: finding.threshold,
        killed: finding.killed,
        survived: finding.survived,
        noCoverage: finding.noCoverage,
        timeout: finding.timeout,
      };
    case "timing":
      return {
        lane: finding.lane,
        tool: finding.tool,
        kind: "timing",
        rule: finding.rule,
        value: finding.value,
        threshold: finding.threshold,
        metric: finding.metric,
        bench: finding.bench,
        baseline: finding.baseline,
        hz: finding.hz,
        gate: finding.gate,
      };
    default: {
      const exhaustive: never = finding;
      throw new Error(`Unknown finding: ${String(exhaustive)}`);
    }
  }
}

function toSarifResult(finding: Finding, cwd: string): SarifResult {
  return {
    ruleId: sarifRuleId(finding),
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
    properties: sarifProperties(finding, cwd),
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
              {
                id: "dependency-cruiser",
                shortDescription: { text: "Architecture dependency rule (dependency-cruiser)" },
              },
              {
                id: "mutation-score",
                shortDescription: { text: "Mutation score (StrykerJS)" },
              },
              {
                id: "load-regression",
                shortDescription: { text: "Load/soak p95 vs baseline (Artillery)" },
              },
              {
                id: "load-ceiling",
                shortDescription: { text: "Load/soak p95 vs absolute ceiling (Artillery)" },
              },
              {
                id: "micro-regression",
                shortDescription: { text: "Micro-bench mean vs baseline (Vitest)" },
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
