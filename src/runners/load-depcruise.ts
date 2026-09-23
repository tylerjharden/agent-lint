import { GateError } from "../errors.js";

export interface DepcruiseOptions {
  tsConfig?: { fileName?: string };
}

export interface DepcruiseApi {
  cruise: (
    files: string[],
    options?: DepcruiseOptions,
    resolveOptions?: undefined,
    transpile?: { tsConfig: unknown },
  ) => Promise<{ output: unknown }>;
  extractDepcruiseOptions: (configPath: string) => Promise<DepcruiseOptions>;
  extractTSConfig: (tsConfigPath: string) => unknown;
}

function asFunction(value: unknown, label: string): (...args: never[]) => unknown {
  if (typeof value !== "function") {
    throw new Error(`${label} is not a function`);
  }
  return value as (...args: never[]) => unknown;
}

export async function loadDepcruise(): Promise<DepcruiseApi> {
  try {
    const [main, optionsMod, tsMod] = await Promise.all([
      import("dependency-cruiser"),
      import("dependency-cruiser/config-utl/extract-depcruise-options"),
      import("dependency-cruiser/config-utl/extract-ts-config"),
    ]);
    const cruise = asFunction(main.cruise, "dependency-cruiser.cruise");
    const extractOptions = asFunction(
      (optionsMod as { default?: unknown }).default,
      "extractDepcruiseOptions",
    );
    const extractTs = asFunction(
      (tsMod as { default?: unknown }).default,
      "extractTSConfig",
    );
    return {
      cruise: cruise as DepcruiseApi["cruise"],
      extractDepcruiseOptions: extractOptions as DepcruiseApi["extractDepcruiseOptions"],
      extractTSConfig: extractTs as DepcruiseApi["extractTSConfig"],
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
