# Golden fixtures

Shared pass set covers **complexity and cognitive**. Architecture fixtures are small module graphs under `arch/`. Fail fixtures are labeled by lane in the filename or directory name.

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

Thresholds: `fixtures/agent-lint.config.json` (cyclomatic max 10, cognitive max 15). Architecture rules: `fixtures/arch/.dependency-cruiser.cjs`.
