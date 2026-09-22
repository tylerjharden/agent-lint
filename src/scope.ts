/**
 * Reserved hook for a future diff-scope filter (lint only files an agent
 * touched). Spike #1 returns the full set unchanged.
 */
export function applyScope(files: string[]): string[] {
  return files;
}
