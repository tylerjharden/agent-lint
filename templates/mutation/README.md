# Mutation config templates

These files are **templates**. Copy one into the project, point `mutation.config` at it, and edit the native Stryker fields (`mutate`, `testRunner`, `thresholds.break`).

agent-lint wraps [StrykerJS](https://stryker-mutator.io/) (Apache-2.0). It does not own a mutation engine or a second mutate language.

## Start

1. Copy `stryker.config.json` to the package you want scored (or another path).
2. Set `mutation.config` in `agent-lint.config.json` to that path.
3. Set `mutate` to the files tests actually cover. Keep that glob small; mutation cost scales with files × tests × mutants.
4. Set `thresholds.break` to the floor that should fail the gate. `null` means Stryker will not fail the build; agent-lint then exits 0 when the score is finite.
5. Run `node bin/agent-lint.js mutation src`.

`all` starts Stryker only when `mutation.config` is set, and never for `--stdin-code`.

The copy in this folder stays a starter. Do not treat it as the project's mutation policy.
