import { extname } from "node:path";

export const ESLINT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".mts",
  ".cts",
]);

export const LIZARD_EXTENSIONS = new Set([
  ...ESLINT_EXTENSIONS,
  ".py",
  ".go",
  ".java",
  ".c",
  ".cc",
  ".cpp",
  ".cxx",
  ".h",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".swift",
  ".kt",
  ".kts",
  ".rs",
  ".scala",
  ".m",
  ".mm",
  ".lua",
  ".pl",
  ".vue",
  ".gd",
  ".sol",
  ".erl",
  ".zig",
  ".f",
  ".f90",
  ".r",
  ".R",
]);

export function isJsTsFile(file: string): boolean {
  return ESLINT_EXTENSIONS.has(extname(file).toLowerCase());
}

export function isLizardFile(file: string): boolean {
  return LIZARD_EXTENSIONS.has(extname(file).toLowerCase());
}
