# Golden fixtures

Shared pass set covers **both** lanes. Fail fixtures are labeled by lane in the filename.

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

Thresholds: `fixtures/agent-lint.config.json` (cyclomatic max 10, cognitive max 15).
