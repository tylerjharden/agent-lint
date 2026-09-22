function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "\u0000")
    .replace(/\*/g, "[^/]*")
    .replace(/\u0000/g, ".*");
  return new RegExp(`^${escaped}$`);
}

export function matchesIgnore(relPosix: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    const normalized = pattern.replace(/\\/g, "/");
    if (globToRegExp(normalized).test(relPosix)) {
      return true;
    }
    if (normalized.endsWith("/**") && relPosix.startsWith(normalized.slice(0, -2))) {
      return true;
    }
  }
  return false;
}
