# Unit-bench templates (not G1)

These files are **optional**. They wrap Vitest bench. They are **not** the G1 perf gate.

G1 perf is Artillery (`perf` / `perf.config`). This helper is `perf --unit-bench` / `perf.unitBench`.

Copy the files, write a cheap `bench/*.bench.js`, record means, and point `perf.unitBench` at `unit-bench.config.json`.
