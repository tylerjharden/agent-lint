# Load/soak config templates (Perf lock)

These files are **templates**. Copy them into the package you want gated, point `perf.load` (or alias `perf.config`) at `perf.config.json`, and own the numbers.

Load/soak is [Artillery](https://www.artillery.io/) (MPL-2.0). agent-lint does not own a load generator. This is a Perf lock, not the only Perf claim. Micro-bench is the other lock: `perf --micro` / `perf.micro` (Vitest). Never k6 (AGPL).

## Scheme

Compare Artillery `http.response_time.p95` (milliseconds) to a human-owned baseline:

- fail (exit 1) if `current.p95 > baseline.p95 * (1 + maxRegression)`
- fail (exit 1) if `ceiling` is set and `current.p95 > ceiling`
- error (exit 2) if the script, baseline, server, or Artillery run is missing, invalid, or has 0 HTTP responses

`maxRegression` of `0.5` allows 50% slower than the recorded p95.

Findings use `gate: "load"` and `rule: "load-regression"` or `load-ceiling`.

## Start

1. Copy `perf.config.json`, `load.yml`, `baseline.json`, and `server.js`.
2. Point `perf.load` in `agent-lint.config.json` at the copied `perf.config.json`.
3. Set `target` / `port` to the service you own, or keep `server.js` for a local ping.
4. Record `baseline.json` `p95` from a real `artillery run --output` report (`aggregate.summaries["http.response_time"].p95`). The starter `5000` is a ceiling, not a measured floor.
5. Set `maxRegression` and optional `ceiling`.
6. Run `node bin/agent-lint.js perf --load src`.

`all` starts Artillery when `perf.load` (or `perf.config`) is set, and never for `--stdin-code`.

CLI paths do not become Artillery phases. Artillery reads the YAML script.

The copies in this folder stay starters. Do not treat them as the project's perf policy.
