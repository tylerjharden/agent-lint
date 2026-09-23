import type { Command, Lane } from "./types.js";

export function mutationConfigured(config: { mutation?: { config: string } }): boolean {
  return config.mutation !== undefined;
}

export function lanesFor(command: Command, mutationEnabled = false): Lane[] {
  switch (command) {
    case "complexity":
      return ["complexity"];
    case "cognitive":
      return ["cognitive"];
    case "arch":
      return ["architecture"];
    case "mutation":
      return ["mutation"];
    case "all":
      if (mutationEnabled) {
        return ["complexity", "cognitive", "architecture", "mutation"];
      }
      return ["complexity", "cognitive", "architecture"];
    default: {
      const exhaustive: never = command;
      throw new Error(`Unknown command: ${String(exhaustive)}`);
    }
  }
}
