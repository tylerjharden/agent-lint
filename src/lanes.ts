import type { Command, Lane } from "./types.js";

export function lanesFor(command: Command): Lane[] {
  switch (command) {
    case "complexity":
      return ["complexity"];
    case "cognitive":
      return ["cognitive"];
    case "all":
      return ["complexity", "cognitive"];
    default: {
      const exhaustive: never = command;
      throw new Error(`Unknown command: ${String(exhaustive)}`);
    }
  }
}
