import { other } from "./cycle-b.js";

export function first() {
  return other();
}
