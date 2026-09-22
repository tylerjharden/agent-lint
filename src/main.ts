import { loadConfig } from "./config.js";
import { GateError } from "./errors.js";
import { EXIT_ERROR, type ExitCode } from "./exit.js";
import { helpText } from "./help.js";
import { parseArgs } from "./parse-args.js";
import { formatReport, reportFromError } from "./report.js";
import { runLint } from "./run.js";
import { readStdin, stdinIsPiped } from "./stdin.js";
import { packageVersion } from "./version.js";

function writeOut(text: string): void {
  process.stdout.write(text);
}

function writeErr(text: string): void {
  process.stderr.write(text);
}

function formatCaught(error: unknown, argsFormat: "human" | "json" | "sarif"): string {
  const message = error instanceof Error ? error.message : String(error);
  const report = reportFromError(message, [], {
    cyclomatic: 0,
    cognitive: 0,
  });
  if (argsFormat === "human") {
    return `error: ${message}\n`;
  }
  return formatReport(report, argsFormat);
}

export async function main(argv: string[]): Promise<ExitCode> {
  let format: "human" | "json" | "sarif" = "human";
  try {
    const args = parseArgs(argv);
    format = args.format;
    if (args.help) {
      writeOut(helpText());
      return 0;
    }
    if (args.version) {
      writeOut(`${packageVersion()}\n`);
      return 0;
    }

    const wantsStdin = args.stdin || args.stdinCode || (args.paths.length === 0 && stdinIsPiped());
    if (args.paths.length === 0 && stdinIsPiped() && !args.stdinCode) {
      args.stdin = true;
    }

    const stdinText = wantsStdin ? await readStdin() : undefined;
    const config = loadConfig(args);
    const report = await runLint(args, config, stdinText);
    writeOut(formatReport(report, args.format));
    return report.exitCode;
  } catch (error) {
    const text = formatCaught(error, format);
    if (format === "human") {
      writeErr(text);
    } else {
      writeOut(text);
    }
    if (error instanceof GateError) {
      return error.exitCode;
    }
    return EXIT_ERROR;
  }
}
