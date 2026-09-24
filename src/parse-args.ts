import { GateError } from "./errors.js";
import type { CliArgs, Command, Format } from "./types.js";

const COMMANDS: readonly Command[] = [
  "complexity",
  "cognitive",
  "arch",
  "mutation",
  "perf",
  "all",
];

function asCommand(value: string): Command | undefined {
  if (value === "mutate") {
    return "mutation";
  }
  if ((COMMANDS as readonly string[]).includes(value)) {
    return value as Command;
  }
  return undefined;
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

function parseFormat(raw: string): Format {
  if (!isFormat(raw)) {
    throw new GateError(`Unknown format: ${raw} (expected human|json|sarif)`);
  }
  return raw;
}

type FlagFn = (args: CliArgs, argv: string[], index: number) => number;

const FLAG_HANDLERS: Record<string, FlagFn> = {
  "--help": (args) => {
    args.help = true;
    return 1;
  },
  "-h": (args) => {
    args.help = true;
    return 1;
  },
  "--version": (args) => {
    args.version = true;
    return 1;
  },
  "-v": (args) => {
    args.version = true;
    return 1;
  },
  "--json": (args) => {
    args.format = "json";
    return 1;
  },
  "--sarif": (args) => {
    args.format = "sarif";
    return 1;
  },
  "--stdin": (args) => {
    args.stdin = true;
    return 1;
  },
  "--stdin-code": (args) => {
    args.stdinCode = true;
    return 1;
  },
  "--unit-bench": (args) => {
    args.unitBench = true;
    return 1;
  },
  "--format": (args, argv, index) => {
    args.format = parseFormat(takeValue(argv, index, "--format"));
    return 2;
  },
  "--config": (args, argv, index) => {
    args.configPath = takeValue(argv, index, "--config");
    return 2;
  },
  "--stdin-file-path": (args, argv, index) => {
    args.stdinFilePath = takeValue(argv, index, "--stdin-file-path");
    return 2;
  },
  "--max-cyclomatic": (args, argv, index) => {
    args.maxCyclomatic = parsePositiveInt(takeValue(argv, index, "--max-cyclomatic"), "--max-cyclomatic");
    return 2;
  },
  "--max-cognitive": (args, argv, index) => {
    args.maxCognitive = parsePositiveInt(takeValue(argv, index, "--max-cognitive"), "--max-cognitive");
    return 2;
  },
};

const FLAGS_WITH_VALUE = new Set([
  "--format",
  "--config",
  "--stdin-file-path",
  "--max-cyclomatic",
  "--max-cognitive",
]);

function applyFlag(flag: string, argv: string[], index: number, args: CliArgs): number {
  const handler = FLAG_HANDLERS[flag];
  if (handler === undefined) {
    throw new GateError(`Unknown option: ${flag}`);
  }
  return handler(args, argv, index);
}

function consumePositionals(argv: string[]): { command: Command; rest: string[] } {
  const rest: string[] = [];
  let command: Command | undefined;
  let index = 0;
  while (index < argv.length) {
    const token = argv[index];
    if (token === undefined) {
      break;
    }
    if (token === "--") {
      rest.push(...argv.slice(index + 1));
      break;
    }
    if (token.startsWith("-")) {
      const skip = FLAGS_WITH_VALUE.has(token) ? 2 : 1;
      rest.push(...argv.slice(index, index + skip));
      index += skip;
      continue;
    }
    if (command === undefined) {
      const parsed = asCommand(token);
      if (parsed !== undefined) {
        command = parsed;
        index += 1;
        continue;
      }
    }
    rest.push(token);
    index += 1;
  }
  return { command: command ?? "all", rest };
}

export function parseArgs(argv: string[]): CliArgs {
  const peeled = consumePositionals(argv);
  const args: CliArgs = {
    command: peeled.command,
    paths: [],
    format: "human",
    stdin: false,
    stdinCode: false,
    stdinFilePath: "stdin.ts",
    unitBench: false,
    help: false,
    version: false,
  };

  let index = 0;
  const tokens = peeled.rest;
  while (index < tokens.length) {
    const token = tokens[index];
    if (token === undefined) {
      break;
    }
    if (token === "--") {
      args.paths.push(...tokens.slice(index + 1));
      break;
    }
    if (token.startsWith("-")) {
      index += applyFlag(token, tokens, index, args);
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
