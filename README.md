# agent-lint

Thin Node/TypeScript CLI that **wraps** existing analyzers and normalizes their output into one fail-closed gate.

This is **not** a mega-linter and **not** a wisdom substitute. It reports cyclomatic complexity, cognitive complexity, architecture rule breaches, mutation-score misses, and perf regressions versus a human baseline, then exits.

Spike #4 adds perf (Vitest bench). BC stays out of scope.

## Repo

- Package: `agent-lint` (bin: `agent-lint`)
- Source of truth: [`tylerjharden/agent-lint`](https://github.com/tylerjharden/agent-lint)
- Clone: `git clone https://github.com/tylerjharden/agent-lint.git`

## Real vs mock

**Real.** `agent-lint` actually invokes:

| Lane | What runs |
|------|-----------|
| Cyclomatic | [lizard](https://github.com/terryyin/lizard) (MIT) **and** ESLint [`complexity`](https://eslint.org/docs/latest/rules/complexity) (MIT) |
| Cognitive | [`eslint-plugin-sonarjs`](https://www.npmjs.com/package/eslint-plugin-sonarjs) `cognitive-complexity` (LGPL-3.0) |
| Architecture | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) (MIT) |
| Mutation | [StrykerJS](https://stryker-mutator.io/) `@stryker-mutator/core` (Apache-2.0) |
| Perf | [Vitest](https://vitest.dev/) `vitest bench` (MIT) |

It does **not** invent CCN, cognitive scores, a module graph, mutants, or timings. If lizard, ESLint/sonarjs, dependency-cruiser, Stryker, or Vitest cannot run, the process exits **2** (never a soft pass).

Lizard parsers can still “soft-fail” on broken syntax (that is lizard’s behavior). We surface a tool crash as exit 2; we do not re-parse the file ourselves.

## Wrap vs own

| We wrap (buy) | We own (thin) |
|---------------|---------------|
| lizard CLI (`python3 -m lizard --csv`) | CLI, config, path/stdin collection |
| ESLint `complexity` | Exit codes `0 / 1 / 2` |
| sonarjs `cognitive-complexity` | Human / JSON / SARIF normalize |
| dependency-cruiser `cruise()` + native rule files | `arch` command and Finding normalize |
| StrykerJS `runMutationTest()` + native Stryker files | `mutation` command and score Finding |
| Vitest `bench` + `--outputJson` | `perf` command, baseline compare, timing Finding |
| | Optional future diff-scope hook (`src/scope.ts`) |

We do **not** build parsers, a graph engine, a mutation engine, a benchmark engine, or another Sonar.

## Install

Requires **Node 20+**. Lizard is a separate Python tool (MIT):

```bash
git clone https://github.com/tylerjharden/agent-lint.git
cd agent-lint
npm install
pip install -r requirements.txt   # lizard
python3 -m lizard --version
npm run build
```

`eslint-plugin-sonarjs` is an **npm devDependency** (see [Licensing](#licensing)). A production install with `--omit=dev` will fail the cognitive lane closed (exit 2) until that plugin is installed.

`dependency-cruiser` is an **npm dependency** (MIT). A missing install fails the architecture lane closed (exit 2).

`@stryker-mutator/core` is an **npm dependency** (Apache-2.0). A missing install fails the mutation lane closed (exit 2). Test-runner plugins stay in the project that owns the Stryker file.

`vitest` is an **npm dependency** (MIT). A missing install fails the perf lane closed (exit 2). Bench files stay in the project that owns the perf config.

## How to run

After `npm run build`:

```bash
# default command is "all" (complexity + cognitive + architecture; mutation and perf only if configured)
node bin/agent-lint.js all src
node dist/cli.js complexity fixtures/pass
npx agent-lint cognitive src --json
node bin/agent-lint.js arch src
node dist/cli.js mutation fixtures/mutation/pass-01-add --config test/mutation-enabled.json
node dist/cli.js mutate fixtures/mutation/pass-01-add --config test/mutation-enabled.json
node dist/cli.js perf fixtures/perf/pass-01-add --config test/perf-enabled.json

# paths and/or stdin
echo fixtures/pass/pass-01-add.ts | node bin/agent-lint.js --stdin
cat snippet.ts | node bin/agent-lint.js --stdin-code --stdin-file-path snippet.ts

# formats
node bin/agent-lint.js all src --format human
node bin/agent-lint.js all src --json
node bin/agent-lint.js all src --sarif
```

`--stdin-code` runs cyclomatic and cognitive only. It skips architecture, mutation, and perf because a snippet has no module graph, no test run, and no bench file. `arch --stdin-code`, `mutation --stdin-code`, and `perf --stdin-code` exit **2**.

CI-ready invocations (same binary):

```bash
npx agent-lint all src --format json
node bin/agent-lint.js all src --format sarif
node dist/cli.js all src
node dist/cli.js arch src --format json
node dist/cli.js mutation src --format json
node dist/cli.js perf src --format json
```

### Commands

| Command | Lanes |
|---------|--------|
| `complexity` | lizard + ESLint `complexity` |
| `cognitive` | sonarjs `cognitive-complexity` |
| `arch` | dependency-cruiser |
| `mutation` (`mutate`) | StrykerJS |
| `perf` | Vitest bench vs baseline |
| `all` (default) | configured applicable lanes |

`all` includes mutation only when `mutation.config` is set. `all` includes perf only when `perf.config` is set.

### Exit codes

| Code | Meaning |
|------|---------|
| **0** | Pass — no function over threshold, no architecture `error`, mutation score ≥ `thresholds.break` when mutation ran, and no bench over `baseline * (1 + maxRegression)` when perf ran |
| **1** | Fail — threshold breach, architecture rule breach, mutation score below `thresholds.break`, or perf regression |
| **2** | Error — tool missing, config broken, no applicable files, unscorable mutation run, or unscorable perf run. **Never** treated as pass |

## Config

Searched from the working directory, first hit wins:

1. `--config <path>`
2. `agent-lint.config.json`
3. `.agent-lintrc.json`
4. `.agent-lintrc`
5. `package.json` → `"agentLint"`
6. built-in defaults

### Defaults

| Key | Default | Notes |
|-----|---------|-------|
| `cyclomatic.max` | **10** | Tighter than ESLint’s rule default (20) and lizard’s warning default (15). The stricter bar is intentional. |
| `cyclomatic.tools` | `["lizard", "eslint"]` | Drop `lizard` only if you explicitly cannot install it. Missing lizard with lizard still listed is exit **2**. |
| `cognitive.max` | **15** | Same as sonarjs’s usual default. |
| `architecture.config` | `.dependency-cruiser.cjs` | Native dependency-cruiser file. Missing or unreadable is exit **2**. |
| `mutation.config` | unset | Native Stryker file. Unset means `all` does not start Stryker. Missing or unreadable when the mutation lane runs is exit **2**. |
| `perf.config` | unset | Perf glue file (Vitest config path, baseline, `maxRegression`). Unset means `all` does not start Vitest bench. Missing or unreadable when the perf lane runs is exit **2**. |
| `ignore` | `node_modules/**`, `dist/**`, `coverage/**`, `.git/**` | Prefix globs. |

CLI overrides: `--max-cyclomatic <n>` and `--max-cognitive <n>`. There is no `--max-mutation` or `--max-perf`. Humans set `thresholds.break` in the Stryker file and `maxRegression` in the perf file.

Example `agent-lint.config.json`:

```json
{
  "cyclomatic": { "max": 10, "tools": ["lizard", "eslint"] },
  "cognitive": { "max": 15 },
  "architecture": { "config": ".dependency-cruiser.cjs" },
  "mutation": { "config": "stryker.config.json" },
  "perf": { "config": "perf.config.json" },
  "ignore": ["node_modules/**", "dist/**", "fixtures/**"]
}
```

`max` must be a positive integer. Invalid JSON, unknown tools, or a missing `--config` path → exit **2**.

### Architecture rule packs

`architecture.config` is a path to a **native** dependency-cruiser file. agent-lint does not add a second rule language.

The file at `templates/architecture/layering.template.cjs` is a **template**. Copy it, rename the `ui` / `app` / `domain` prefixes, and own the result after a human ADR. The repo root `.dependency-cruiser.cjs` is a conservative shipped copy (`no-circular`, no `src` → `fixtures`) so `npm run lint:self` can run `all src`. Harsh layering is not that default.

Only dependency-cruiser rules with severity `error` fail the gate (exit 1). `warn` and `info` do not.

### Mutation config

`mutation.config` is a path to a **native** Stryker file. agent-lint does not add a second mutate language, plugin list, or reporter list.

The file at `templates/mutation/stryker.config.json` is a **template**. Copy it, set `mutate` and `thresholds.break`, and point `mutation.config` at the copy. The repo root `agent-lint.config.json` leaves mutation unset so `npm run lint:self` does not start Stryker.

Honor native `thresholds.break`:

- number — score below break is exit **1**
- `null` / omitted — a finite score is exit **0**
- missing config, thrown runner, or 0 valid mutants — exit **2**

CLI paths do not become `mutate`. Stryker reads `mutate` and the test runner from its own file.

Mutation is expensive. Scope `mutate` to the files tests cover. The golden fixtures are one-function packages with `concurrency: 1`. Measured on this machine with `npx stryker run`:

| Fixture | Score | Elapsed |
|---------|-------|---------|
| `fixtures/mutation/pass-01-add` | 100 (2 killed) | 1.1s |
| `fixtures/mutation/fail-01-survived` | 60 (3 killed, 2 survived) | 1.3s |
| `fixtures/mutation/empty-01-no-mutants` | n/a (0 valid mutants) | 1.0s |

`all` does not start Stryker unless `mutation.config` is set. Time a wider glob before putting it on CI.

### Perf config

`perf.config` is a path to a **perf glue file**. That file points at a native Vitest config, a human-owned `baseline.json`, and `maxRegression`. agent-lint does not own a benchmark engine.

The files under `templates/perf/` are **templates**. Copy them, write a cheap `bench/*.bench.js`, record baseline means, and point `perf.config` at the copy. The repo root `agent-lint.config.json` leaves perf unset so `npm run lint:self` does not start Vitest bench.

Honor the glue file:

- `runner` — `vitest` (default). Other runners, including hyperfine, are not this wrap.
- `config` — native Vitest file. Missing or thrown is exit **2**.
- `baseline` — JSON `{ "benches": [{ "name", "mean" }] }`. `mean` uses the same unit Vitest writes (`--outputJson`). Missing, empty, or non-positive means are exit **2**.
- `maxRegression` — finite number ≥ 0. `0.5` allows 50% slower than baseline. Missing or invalid is exit **2**.

Compare is `current.mean > baseline.mean * (1 + maxRegression)`:

- under the allowed mean — exit **0**
- over the allowed mean — exit **1** (`kind: "timing"`)
- missing config, thrown runner, 0 benches, or name mismatch with the baseline — exit **2**

CLI paths do not become bench includes. Vitest reads `benchmark.include` from its own file.

Perf fixtures stay cheap (`time: 50`, few iterations). Measured on this machine with `node dist/cli.js perf`:

| Fixture | Result | Elapsed |
|---------|--------|---------|
| `fixtures/perf/pass-01-add` | under ceiling mean `1` | 1.0s |
| `fixtures/perf/fail-01-regression` | over tight mean `1e-12` | 1.0s |
| `fixtures/perf/empty-01-no-benches` | 0 benches | 0.7s |

`all` does not start Vitest bench unless `perf.config` is set. Do not put a wide bench glob on CI without timing it.

## Fixtures

`npm test` (alias: `npm run fixtures`) builds the CLI and asserts golden exit codes.

| Set | Count | Expected |
|-----|-------|----------|
| `fixtures/pass/*` | 3 TS (complexity + cognitive) + 1 Python (lizard) | exit 0 |
| `fixtures/fail/fail-cyclo-*` | 3 TS + 1 Python | `complexity` → exit 1 |
| `fixtures/fail/fail-cog-*` | 3 TS | `cognitive` → exit 1 |
| `fixtures/arch/pass-*` | 3 module graphs | `arch` → exit 0 |
| `fixtures/arch/fail-*` | 3 module graphs | `arch` → exit 1 |
| `fixtures/mutation/pass-01-add` | 1 function + tests | `mutation` → exit 0 |
| `fixtures/mutation/fail-01-survived` | 1 function, surviving mutants | `mutation` → exit 1 |
| `fixtures/mutation/empty-01-no-mutants` | no valid mutants | `mutation` → exit 2 |
| `fixtures/perf/pass-01-add` | 1 function + cheap bench | `perf` → exit 0 |
| `fixtures/perf/fail-01-regression` | same bench, tight baseline | `perf` → exit 1 |
| `fixtures/perf/empty-01-no-benches` | no `bench()` calls | `perf` → exit 2 |
| `test/broken/*` | invalid JSON / max / tools / missing arch, mutation, or perf config | exit 2 |

Labels live in the filenames and directory names. See `fixtures/README.md`.

## Licensing

- **agent-lint** source: MIT
- **lizard**: MIT (`pip install lizard`)
- **ESLint** and `@typescript-eslint/parser`: MIT
- **dependency-cruiser**: MIT
- **@stryker-mutator/core**: Apache-2.0
- **vitest**: MIT
- **eslint-plugin-sonarjs**: **LGPL-3.0-only**

LGPL rules for this repo:

- The plugin is listed as an npm **`devDependency` only**.
- It is loaded with a **dynamic import** (`src/runners/load-sonarjs.ts`). We do **not** statically bundle it into a redistributable binary (`pkg`, esbuild `--bundle`, etc.).
- Do not vendor or concatenate the plugin into `dist/`.

`@stryker-mutator/core` is a regular dependency and is also loaded with a dynamic import (`src/runners/load-stryker.ts`). Do not bundle it.

`vitest` is a regular dependency. The wrap resolves the CLI (`vitest/vitest.mjs`) and spawns `vitest bench`. Do not bundle it.

If you redistribute a compiled binary of this CLI, keep sonarjs, Stryker, and Vitest as separate installable modules.

## What this is not

- Not a custom benchmark engine. Not Bencher. Not k6 or Artillery.
- Not hyperfine (fine later for CLI binaries; this wrap is Vitest bench).
- Not BC detection.
- Not a training reward signal.
- Not a claim that low complexity, a green architecture lane, a high mutation score, or a stable bench equals good design.
- Not a substitute for a human ADR on layering, a human-owned Stryker file, or a human-owned baseline.

## Layout

```
src/            orchestrator (args, config, runners, report)
bin/            node bin/agent-lint.js
templates/      human-owned architecture, mutation, and perf starters
fixtures/       golden pass/fail samples
test/           node:test exit-code assertions
```
