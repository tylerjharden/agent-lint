import { createRequire } from "node:module";
import { GateError } from "../errors.js";

export function resolveVitestCli(): string {
  try {
    const require = createRequire(import.meta.url);
    return require.resolve("vitest/vitest.mjs");
  } catch (cause) {
    throw new GateError(
      "vitest is not installed or failed to load. Install it with: npm install vitest (MIT).",
      { cause },
    );
  }
}
