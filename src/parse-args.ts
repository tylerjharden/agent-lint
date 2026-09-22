import { GateError } from "./errors.js";
import type { CliArgs, Command, Format } from "./types.js";

const COMMANDS: readonly Command[] = ["complexity", "cognitive", "all"];

function isCommand(value: string): value is Command {
  return (COMMANDS as readonly string[]).includes(value);
}

function isFormat(value: string): value is Format {
  return value === "human" || value === "json" || value === "sarif";
}

function takeValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("-")) {
    throw new GateError(`Missing value for ${flag}`);
  }
  return value;
}

function parsePositiveInt(raw: string, flag: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new GateError(`${flag} must be a positive integer, got ${JSON.stringify(raw)}`);
  }
  return value;
}

function applyFlag(
  flag: string,
  argv: string[],
  index: number,
  args: CliArgs,
): number {
  switch (flag) {
    case "--help":
    case "-h":
      args.help = true;
      return 1;
    case "--version":
    case "-v":
      args.version = true;
      return 1;
    case "--json":
      args.format = "json";
      return 1;
    case "--sarif":
      args.format = "sarif";
      return 1;
    case "--stdin":
      args.stdin = true;
      return 1;
    case "--stdin-code":
      args.stdinCode = true;
      return 1;
    case "--format":
      args.format = parseFormat(takeValue(argv, index, flag));
      return 2;
    case "--config":
      args.configPath = takeValue(argv, index, flag);
      return 2;
    case "--stdin-file-path":
      args.stdinFilePath = takeValue(argv, index, flag);
      return 2;
    case "--max-cyclomatic":
      args.maxCyclomatic = parsePositiveInt(takeValue(argv, index, flag), flag);
      return 2;
    case "--max-cognitive":
      args.maxCognitive = parsePositiveInt(takeValue(argv, index, flag), flag);
      return 2;
    default: {
      throw new GateError(`Unknown option: ${flag}`);
    }
  }
}

function parseFormat(raw: string): Format {
  if (!isFormat(raw)) {
    throw new GateError(`Unknown format: ${raw} (expected human|json|sarif)`);
  }
  return raw;
}

export function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    command: "all",
    paths: [],
    format: "human",
    stdin: false,
    stdinCode: false,
    stdinFilePath: "stdin.ts",
    help: false,
    version: false,
  };

  let index = 0;
  if (argv[0] !== undefined && isCommand(argv[0])) {
    args.command = argv[0];
    index = 1;
  }

  while (index < argv.length) {
    const token = argv[index];
    if (token === undefined) {
      break;
    }
    if (token === "--") {
      args.paths.push(...argv.slice(index + 1));
      break;
    }
    if (token.startsWith("-")) {
      index += applyFlag(token, argv, index, args);
      continue;
    }
    args.paths.push(token);
    index += 1;
  }

  if (args.stdin && args.stdinCode) {
    throw new GateError("Use either --stdin (path list) or --stdin-code (source), not both");
  }

  return args;
}
