import type { Command, Lane } from "./types.js";

export interface LaneEnablement {
  mutation?: boolean;
  perf?: boolean;
}

export function mutationConfigured(config: { mutation?: { config: string } }): boolean {
  return config.mutation !== undefined;
}

export function loadConfigured(config: { perf?: { load?: string } }): boolean {
  return config.perf?.load !== undefined;
}

export function microConfigured(config: { perf?: { micro?: string } }): boolean {
  return config.perf?.micro !== undefined;
}

export function perfConfigured(config: { perf?: { load?: string; micro?: string } }): boolean {
  return loadConfigured(config) || microConfigured(config);
}

function allLanes(enabled: LaneEnablement): Lane[] {
  const lanes: Lane[] = ["complexity", "cognitive", "architecture"];
  if (enabled.mutation === true) {
    lanes.push("mutation");
  }
  if (enabled.perf === true) {
    lanes.push("perf");
  }
  return lanes;
}

export function lanesFor(command: Command, enabled: LaneEnablement | boolean = {}): Lane[] {
  const flags: LaneEnablement = typeof enabled === "boolean" ? { mutation: enabled } : enabled;
  switch (command) {
    case "complexity":
      return ["complexity"];
    case "cognitive":
      return ["cognitive"];
    case "arch":
      return ["architecture"];
    case "mutation":
      return ["mutation"];
    case "perf":
      return ["perf"];
    case "all":
      return allLanes(flags);
    default: {
      const exhaustive: never = command;
      throw new Error(`Unknown command: ${String(exhaustive)}`);
    }
  }
}
