import type { ICruiseOptions, IReporterOutput } from "dependency-cruiser";
import { GateError } from "../errors.js";

export interface DepcruiseApi {
  cruise: (
    files: string[],
    options?: ICruiseOptions,
    resolveOptions?: undefined,
    transpile?: { tsConfig: unknown },
  ) => Promise<IReporterOutput>;
  extractDepcruiseOptions: (configPath: string) => Promise<ICruiseOptions>;
  extractTSConfig: (tsConfigPath: string) => unknown;
}

function requireFunction(value: unknown, label: string): void {
  if (typeof value !== "function") {
    throw new Error(`${label} is not a function`);
  }
}

export async function loadDepcruise(): Promise<DepcruiseApi> {
  try {
    const [main, optionsMod, tsMod] = await Promise.all([
      import("dependency-cruiser"),
      import("dependency-cruiser/config-utl/extract-depcruise-options"),
      import("dependency-cruiser/config-utl/extract-ts-config"),
    ]);
    requireFunction(main.cruise, "dependency-cruiser.cruise");
    requireFunction(optionsMod.default, "extractDepcruiseOptions");
    requireFunction(tsMod.default, "extractTSConfig");
    return {
      cruise: main.cruise,
      extractDepcruiseOptions: optionsMod.default,
      extractTSConfig: tsMod.default,
    };
  } catch (cause) {
    if (cause instanceof GateError) {
      throw cause;
    }
    throw new GateError(
      "dependency-cruiser is not installed or failed to load. Install it with: npm install dependency-cruiser (MIT).",
      { cause },
    );
  }
}
