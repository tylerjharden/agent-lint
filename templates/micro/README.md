# Micro-bench templates (Perf lock)

These files are the **micro-bench / unit perf** lock under Perf. They wrap [Vitest](https://vitest.dev/) `bench` (MIT). This is not optional and not a side path.

Load/soak is a separate Perf lock: Artillery via `perf --load` / `perf.load`. Both locks live under the `perf` command.

Hyperfine is an allowed alternate micro runner. This wrap ships Vitest. Do not point `perf.micro` at a hyperfine script.

Copy the files, write a cheap `bench/*.bench.js`, record means, and point `perf.micro` at `micro.config.json`.

```bash
node dist/cli.js perf --micro src --config agent-lint.config.json
```

`all` starts micro-bench when `perf.micro` is set. `--micro` with any command other than `perf` is exit **2**.
