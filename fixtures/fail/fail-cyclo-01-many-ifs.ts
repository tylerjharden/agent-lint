/** Golden fail (complexity): sequential decisions — high CCN, labeled cyclo. */
export function routeByCode(code: number): string {
  if (code === 1) return "alpha";
  if (code === 2) return "beta";
  if (code === 3) return "gamma";
  if (code === 4) return "delta";
  if (code === 5) return "epsilon";
  if (code === 6) return "zeta";
  if (code === 7) return "eta";
  if (code === 8) return "theta";
  if (code === 9) return "iota";
  if (code === 10) return "kappa";
  if (code === 11) return "lambda";
  if (code === 12) return "mu";
  if (code === 13) return "nu";
  if (code === 14) return "xi";
  if (code === 15) return "omicron";
  if (code === 16) return "pi";
  return "unknown";
}
