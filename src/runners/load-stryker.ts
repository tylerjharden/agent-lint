import { GateError } from "../errors.js";

export interface MutantLike {
  status: string;
}

export interface StrykerApi {
  runMutationTest: (configFile: string) => Promise<MutantLike[]>;
}

interface StrykerConstructable {
  new (options: { configFile: string }): { runMutationTest: () => Promise<MutantLike[]> };
}

function requireConstructor(value: unknown, label: string): asserts value is StrykerConstructable {
  if (typeof value !== "function") {
    throw new Error(`${label} is not a constructor`);
  }
}

export async function loadStryker(): Promise<StrykerApi> {
  try {
    const mod = (await import("@stryker-mutator/core")) as { Stryker?: unknown };
    requireConstructor(mod.Stryker, "@stryker-mutator/core.Stryker");
    const Stryker = mod.Stryker;
    return {
      runMutationTest: async (configFile) => {
        const instance = new Stryker({ configFile });
        if (typeof instance.runMutationTest !== "function") {
          throw new Error("Stryker.runMutationTest is not a function");
        }
        return instance.runMutationTest();
      },
    };
  } catch (cause) {
    if (cause instanceof GateError) {
      throw cause;
    }
    throw new GateError(
      "@stryker-mutator/core is not installed or failed to load. Install it with: npm install @stryker-mutator/core (Apache-2.0).",
      { cause },
    );
  }
}
