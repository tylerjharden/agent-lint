import { bench } from "vitest";
import { add } from "../src/add.js";

bench("add", () => {
  add(1, 2);
}, { time: 50, iterations: 20, warmupTime: 0, warmupIterations: 1 });
