import { existsSync, readdirSync, statSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { GateError } from "./errors.js";
import { isJsTsFile, isLizardFile } from "./extensions.js";
import { matchesIgnore } from "./ignore.js";
import { applyScope } from "./scope.js";

const SKIP_DIR_NAMES = new Set([
  "node_modules",
  ".git",
  "dist",
  "coverage",
  "reports",
  ".stryker-tmp",
]);

function toPosix(rel: string): string {
  return rel.split(sep).join("/");
}

function walkFile(abs: string, cwd: string, ignore: string[], out: string[]): void {
  const rel = toPosix(relative(cwd, abs));
  if (rel.startsWith("..")) {
    if (isLizardFile(abs) || isJsTsFile(abs)) {
      out.push(abs);
    }
    return;
  }
  if (matchesIgnore(rel, ignore)) {
    return;
  }
  if (isLizardFile(abs) || isJsTsFile(abs)) {
    out.push(abs);
  }
}

function walkDir(abs: string, cwd: string, ignore: string[], out: string[]): void {
  const rel = toPosix(relative(cwd, abs));
  if (rel !== "" && matchesIgnore(rel, ignore)) {
    return;
  }
  if (rel !== "" && matchesIgnore(`${rel}/**`, ignore)) {
    return;
  }
  const entries = readdirSync(abs, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) {
      continue;
    }
    const child = resolve(abs, entry.name);
    if (entry.isDirectory()) {
      walkDir(child, cwd, ignore, out);
      continue;
    }
    if (entry.isFile()) {
      walkFile(child, cwd, ignore, out);
    }
  }
}

export function collectFromPaths(paths: string[], cwd: string, ignore: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const input of paths) {
    const abs = resolve(cwd, input);
    if (!existsSync(abs)) {
      throw new GateError(`Path does not exist: ${input}`);
    }
    const info = statSync(abs);
    const batch: string[] = [];
    if (info.isDirectory()) {
      walkDir(abs, cwd, ignore, batch);
    } else if (info.isFile()) {
      walkFile(abs, cwd, ignore, batch);
    } else {
      throw new GateError(`Not a file or directory: ${input}`);
    }
    for (const file of batch) {
      if (!seen.has(file)) {
        seen.add(file);
        out.push(file);
      }
    }
  }
  return applyScope(out);
}

export function parsePathList(text: string): string[] {
  const paths: string[] = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "" || line.startsWith("#")) {
      continue;
    }
    paths.push(line);
  }
  return paths;
}
