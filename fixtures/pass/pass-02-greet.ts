/** Golden pass: one early return, still well under both gates. */
export function greet(name: string): string {
  if (name.length === 0) {
    return "hello";
  }
  return `hello ${name}`;
}
