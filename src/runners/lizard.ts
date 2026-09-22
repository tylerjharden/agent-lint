import { spawnSync } from "node:child_process";
import { GateError } from "../errors.js";
import { isLizardFile } from "../extensions.js";
import type { Finding } from "../types.js";
import { parseCsvLine } from "./csv.js";

export interface LizardCommand {
  cmd: string;
  prefix: string[];
}

function commandWorks(cmd: string, args: string[]): boolean {
  const probe = spawnSync(cmd, args, { encoding: "utf8" });
  return probe.status === 0;
}

export function resolveLizardCommand(): LizardCommand {
  const override = process.env.LIZARD_BIN;
  if (override !== undefined && override !== "") {
    if (!commandWorks(override, ["--version"])) {
      throw new GateError(`LIZARD_BIN is set but not runnable: ${override}`);
    }
    return { cmd: override, prefix: [] };
  }
  if (commandWorks("python3", ["-m", "lizard", "--version"])) {
    return { cmd: "python3", prefix: ["-m", "lizard"] };
  }
  if (commandWorks("lizard", ["--version"])) {
    return { cmd: "lizard", prefix: [] };
  }
  throw new GateError(
    "lizard is not installed or not runnable. Install with: pip install lizard (MIT). Or set LIZARD_BIN.",
  );
}

function parseLizardRow(fields: string[], threshold: number): Finding | undefined {
  if (fields.length < 11) {
    return undefined;
  }
  const ccn = Number(fields[1]);
  const file = fields[6] ?? "";
  const functionName = fields[7] ?? "";
  const start = Number(fields[9]);
  if (!Number.isFinite(ccn) || file === "") {
    throw new GateError(`Unparseable lizard CSV row: ${fields.join(",")}`);
  }
  if (ccn <= threshold) {
    return undefined;
  }
  const line = Number.isInteger(start) ? start : 1;
  return {
    lane: "complexity",
    tool: "lizard",
    rule: "lizard/cyclomatic",
    file,
    line,
    functionName: functionName === "" ? undefined : functionName,
    metric: "cyclomatic",
    value: ccn,
    threshold,
    message: `Function '${functionName || "unknown"}' has cyclomatic complexity ${ccn} (max ${threshold})`,
  };
}

export function runLizard(files: string[], threshold: number): Finding[] {
  const targets = files.filter(isLizardFile);
  if (targets.length === 0) {
    return [];
  }
  const lizard = resolveLizardCommand();
  const args = [...lizard.prefix, "--csv", "-i", "-1", ...targets];
  const result = spawnSync(lizard.cmd, args, { encoding: "utf8" });
  if (result.error) {
    throw new GateError(`Failed to spawn lizard: ${result.error.message}`, {
      cause: result.error,
    });
  }
  if (result.status !== 0 && result.status !== null) {
    const detail = (result.stderr || result.stdout || "").trim();
    throw new GateError(
      `lizard exited ${result.status}${detail === "" ? "" : `: ${detail}`}`,
    );
  }
  const findings: Finding[] = [];
  for (const rawLine of result.stdout.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") {
      continue;
    }
    const finding = parseLizardRow(parseCsvLine(line), threshold);
    if (finding !== undefined) {
      findings.push(finding);
    }
  }
  return findings;
}
