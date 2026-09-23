# Golden fixtures

Shared pass set covers **complexity and cognitive**. Architecture fixtures are small module graphs under `arch/`. Mutation fixtures are one-function packages under `mutation/`. Perf fixtures are one-function Vitest benches under `perf/`. Fail fixtures are labeled by lane in the filename or directory name.

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
| `perf/pass-01-add` | perf (mean under ceiling 1) | exit 0 |
| `perf/fail-01-regression` | perf (mean over tight 1e-12) | exit 1 |
| `perf/empty-01-no-benches` | perf (0 benches) | exit 2 |

Thresholds: `fixtures/agent-lint.config.json` (cyclomatic max 10, cognitive max 15). Architecture rules: `fixtures/arch/.dependency-cruiser.cjs`. Mutation uses the native `stryker.config.json` in each mutation fixture. Perf uses the `perf.config.json` in each perf fixture. `all` does not start Stryker unless `mutation.config` is set. `all` does not start Vitest bench unless `perf.config` is set.

Measured `npx stryker run` cost: pass-01-add 1.1s (score 100), fail-01-survived 1.3s (score 60), empty-01-no-mutants 1.0s (n/a).

Perf fixtures cap Vitest at `time: 50` and 20 iterations. Measured `node dist/cli.js perf` cost: pass-01-add 1.0s (under ceiling), fail-01-regression 1.0s (over tight mean), empty-01-no-benches 0.7s (0 benches). The pass baseline is a human-owned ceiling (`mean: 1`), not a CI-measured floor.
