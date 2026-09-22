/** Golden fail (complexity): boolean operator soup — labeled cyclo. */
export function allowAccess(flags: Record<string, boolean>): boolean {
  return Boolean(
    (flags.a && flags.b) ||
      (flags.c && flags.d) ||
      (flags.e && flags.f) ||
      (flags.g && flags.h) ||
      (flags.i && flags.j) ||
      (flags.k && flags.l) ||
      (flags.m && flags.n) ||
      (flags.o && flags.p),
  );
}
