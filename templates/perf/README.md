# Perf config templates

These files are **templates**. Copy them into the package you want timed, point `perf.config` at `perf.config.json`, and own the numbers.

agent-lint wraps [Vitest bench](https://vitest.dev/guide/features.html#benchmarking) (MIT). It does not own a benchmark engine. Humans set `maxRegression` and the baseline means.

## Start

1. Copy `perf.config.json`, `vitest.config.js`, and `baseline.json` next to the code you will bench.
2. Write a cheap `bench/*.bench.js` that imports `bench` from `vitest`.
3. Set `perf.config` in `agent-lint.config.json` to the copied `perf.config.json`.
4. Record `baseline.json` means in the same unit Vitest writes (`mean` from `--outputJson`). The starter `mean: 1` is a generous ceiling for a one-function add, not a measured floor.
5. Set `maxRegression` to the slowdown fraction that should fail the gate (`0.5` means 50% slower than baseline).
6. Run `node bin/agent-lint.js perf src`.

`all` starts Vitest bench only when `perf.config` is set, and never for `--stdin-code`.

CLI paths do not become bench includes. Vitest reads `benchmark.include` from its own file.

The copies in this folder stay starters. Do not treat them as the project's perf policy.
