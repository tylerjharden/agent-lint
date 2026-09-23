import type { Command, Lane } from "./types.js";

export function lanesFor(command: Command): Lane[] {
  switch (command) {
    case "complexity":
      return ["complexity"];
    case "cognitive":
      return ["cognitive"];
    case "arch":
      return ["architecture"];
    case "all":
      return ["complexity", "cognitive", "architecture"];
    default: {
      const exhaustive: never = command;
      throw new Error(`Unknown command: ${String(exhaustive)}`);
    }
  }
}
