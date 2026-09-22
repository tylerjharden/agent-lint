import type { ESLint } from "eslint";
import { GateError } from "../errors.js";

/**
 * eslint-plugin-sonarjs is LGPL-3.0 and must stay an npm *devDependency*.
 * Dynamic import (not a static bundle) so a redistributable binary never
 * absorbs the LGPL plugin. Missing or broken load is exit 2 (fail-closed).
 */
export async function loadSonarjsPlugin(): Promise<NonNullable<ESLint.Plugin>> {
  try {
    const loaded = await import("eslint-plugin-sonarjs");
    const plugin = (loaded as { default?: ESLint.Plugin }).default ?? loaded;
    if (plugin === undefined || typeof plugin !== "object") {
      throw new Error("eslint-plugin-sonarjs exported an unexpected value");
    }
    return plugin as ESLint.Plugin;
  } catch (cause) {
    throw new GateError(
      "eslint-plugin-sonarjs is not installed or failed to load. It is LGPL-3.0 — install it as an npm devDependency only (do not bundle): npm install -D eslint-plugin-sonarjs",
      { cause },
    );
  }
}
