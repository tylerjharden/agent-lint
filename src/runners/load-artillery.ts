import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { GateError } from "../errors.js";

export function resolveArtilleryCli(): string {
  try {
    const require = createRequire(import.meta.url);
    const cli = join(dirname(require.resolve("artillery")), "..", "bin", "run");
    if (!existsSync(cli)) {
      throw new Error(`Artillery CLI not found at ${cli}`);
    }
    return cli;
  } catch (cause) {
    throw new GateError(
      "artillery is not installed or failed to load. Install it with: npm install artillery (MPL-2.0).",
      { cause },
    );
  }
}
