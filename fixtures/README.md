# Golden fixtures

Shared pass set covers **complexity and cognitive**. Architecture fixtures are small module graphs under `arch/`. Mutation fixtures are one-function packages under `mutation/`. Load/soak fixtures are cheap Artillery scripts under `perf/`. Micro-bench fixtures live under `micro/`. Fail fixtures are labeled by lane in the filename or directory name.

| Path | Lane | Expected CLI |
|------|------|----------------|
| `pass/pass-01-add.ts` | complexity + cognitive | exit 0 |
| `pass/pass-02-greet.ts` | complexity + cognitive | exit 0 |
| `pass/pass-03-clamp.ts` | complexity + cognitive | exit 0 |
| `pass/pass-04-add.py` | complexity (lizard) | exit 0 |
| `fail/fail-cyclo-01-many-ifs.ts` | complexity | exit 1 |
| `fail/fail-cyclo-02-switch.ts` | complexity | exit 1 |
| `fail/fail-cyclo-03-boolean-soup.ts` | complexity | exit 1 |
| `fail/fail-cyclo-04-nested.py` | complexity (lizard) | exit 1 |
| `fail/fail-cog-01-deep-nest.ts` | cognitive | exit 1 |
| `fail/fail-cog-02-nested-loops.ts` | cognitive | exit 1 |
| `fail/fail-cog-03-mixed-control.ts` | cognitive | exit 1 |
| `arch/pass-01-ui-to-app` | architecture (ui to app to domain) | exit 0 |
| `arch/pass-02-app-to-domain` | architecture (app to domain) | exit 0 |
| `arch/pass-03-domain-only` | architecture (domain, no upward import) | exit 0 |
| `arch/fail-01-domain-to-ui` | architecture (domain imports ui) | exit 1 |
| `arch/fail-02-circular` | architecture (circular pair) | exit 1 |
| `arch/fail-03-app-to-ui` | architecture (app imports ui) | exit 1 |
| `mutation/pass-01-add` | mutation (score ≥ break 80) | exit 0 |
| `mutation/fail-01-survived` | mutation (score < break 80) | exit 1 |
| `mutation/empty-01-no-mutants` | mutation (0 valid mutants) | exit 2 |
| `perf/pass-01-http` | load/soak Artillery (p95 under 60000) | `perf --load` → exit 0 |
| `perf/fail-01-regression` | load/soak Artillery (p95 over 0.001) | `perf --load` → exit 1 |
| `perf/empty-01-no-requests` | load/soak Artillery (0 HTTP responses) | `perf --load` → exit 2 |
| `micro/pass-01-add` | micro-bench Vitest (mean under baseline) | `perf --micro` → exit 0 |
| `micro/fail-01-regression` | micro-bench Vitest (mean over tight baseline) | `perf --micro` → exit 1 |
| `micro/empty-01-no-benches` | micro-bench Vitest (0 benches) | `perf --micro` → exit 2 |

Thresholds: `fixtures/agent-lint.config.json` (cyclomatic max 10, cognitive max 15). Architecture rules: `fixtures/arch/.dependency-cruiser.cjs`. Mutation uses the native `stryker.config.json` in each mutation fixture. Load/soak uses the `perf.config.json` in each `perf/` fixture. Micro-bench uses the `micro.config.json` in each `micro/` fixture. `all` does not start Stryker unless `mutation.config` is set. `all` starts Perf when `perf.micro` and/or `perf.load` is set.

Measured `npx stryker run` cost: pass-01-add 1.1s (score 100), fail-01-survived 1.3s (score 60), empty-01-no-mutants 1.0s (n/a).

Load/soak fixtures are one GET over 1 second to a local ping server. Measured `node dist/cli.js perf --load` cost: pass-01-http 5.0s (under ceiling), fail-01-regression 5.0s (over tight p95), empty-01-no-requests 3.0s (0 HTTP responses). The pass baseline is a human-owned p95 ceiling (`60000`), not a CI-measured floor.
