/** Golden fail (cognitive): mixed if/else/try/catch/loop — labeled cognitive. */
export function hydrate(raw: string, fallback: number): number {
  try {
    if (raw.length === 0) {
      return fallback;
    }
    const parsed = Number(raw);
    if (Number.isNaN(parsed)) {
      if (raw.startsWith("x")) {
        try {
          if (raw.includes(":")) {
            for (const part of raw.split(":")) {
              if (part.length > 1) {
                if (part.includes("-")) {
                  return part.length;
                }
              }
            }
          }
        } catch {
          if (fallback > 0) {
            return fallback;
          }
        }
      }
      return fallback;
    }
    if (parsed < 0) {
      if (fallback > 0) {
        return fallback;
      }
      return 0;
    }
    return parsed;
  } catch {
    return fallback;
  }
}
