# agent-lint

Thin Node/TypeScript CLI that **wraps** existing analyzers and normalizes their output into one fail-closed gate.

This is **not** a mega-linter and **not** a wisdom substitute. It reports cyclomatic complexity, cognitive complexity, and architecture rule breaches, then exits.

Spike #2 adds architecture (dependency-cruiser). Mutation, perf, and BC stay out of scope.

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

It does **not** invent CCN, cognitive scores, or a module graph. If lizard, ESLint/sonarjs, or dependency-cruiser cannot run, the process exits **2** (never a soft pass).

Lizard parsers can still “soft-fail” on broken syntax (that is lizard’s behavior). We surface a tool crash as exit 2; we do not re-parse the file ourselves.

## Wrap vs own

| We wrap (buy) | We own (thin) |
|---------------|---------------|
| lizard CLI (`python3 -m lizard --csv`) | CLI, config, path/stdin collection |
| ESLint `complexity` | Exit codes `0 / 1 / 2` |
| sonarjs `cognitive-complexity` | Human / JSON / SARIF normalize |
| dependency-cruiser `cruise()` + native rule files | `arch` command and Finding normalize |
| | Optional future diff-scope hook (`src/scope.ts`) |

We do **not** build parsers, a graph engine, a mutation engine, or another Sonar.

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

## How to run

After `npm run build`:

```bash
# default command is "all" (complexity + cognitive + architecture)
node bin/agent-lint.js all src
node dist/cli.js complexity fixtures/pass
npx agent-lint cognitive src --json
node bin/agent-lint.js arch src
node dist/cli.js arch fixtures/arch/pass-01-ui-to-app --config fixtures/agent-lint.config.json

# paths and/or stdin
echo fixtures/pass/pass-01-add.ts | node bin/agent-lint.js --stdin
cat snippet.ts | node bin/agent-lint.js --stdin-code --stdin-file-path snippet.ts

# formats
node bin/agent-lint.js all src --format human
node bin/agent-lint.js all src --json
node bin/agent-lint.js all src --sarif
```

`--stdin-code` runs cyclomatic and cognitive only. It skips architecture because a snippet has no module graph. `arch --stdin-code` exits **2**.

CI-ready invocations (same binary):

```bash
npx agent-lint all src --format json
node bin/agent-lint.js all src --format sarif
node dist/cli.js all src
node dist/cli.js arch src --format json
```

### Commands

| Command | Lanes |
|---------|--------|
| `complexity` | lizard + ESLint `complexity` |
| `cognitive` | sonarjs `cognitive-complexity` |
| `arch` | dependency-cruiser |
| `all` (default) | all three |

### Exit codes

| Code | Meaning |
|------|---------|
| **0** | Pass — no function over threshold and no architecture `error` |
| **1** | Fail — threshold breach or architecture rule breach |
| **2** | Error — tool missing, config broken, no applicable files. **Never** treated as pass |

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
| `ignore` | `node_modules/**`, `dist/**`, `coverage/**`, `.git/**` | Prefix globs. |

CLI overrides: `--max-cyclomatic <n>` and `--max-cognitive <n>`.

Example `agent-lint.config.json`:

```json
{
  "cyclomatic": { "max": 10, "tools": ["lizard", "eslint"] },
  "cognitive": { "max": 15 },
  "architecture": { "config": ".dependency-cruiser.cjs" },
  "ignore": ["node_modules/**", "dist/**", "fixtures/**"]
}
```

`max` must be a positive integer. Invalid JSON, unknown tools, or a missing `--config` path → exit **2**.

### Architecture rule packs

`architecture.config` is a path to a **native** dependency-cruiser file. agent-lint does not add a second rule language.

The file at `templates/architecture/layering.template.cjs` is a **template**. Copy it, rename the `ui` / `app` / `domain` prefixes, and own the result after a human ADR. The repo root `.dependency-cruiser.cjs` is a conservative shipped copy (`no-circular`, no `src` → `fixtures`) so `npm run lint:self` can run `all src`. Harsh layering is not that default.

Only dependency-cruiser rules with severity `error` fail the gate (exit 1). `warn` and `info` do not.

## Fixtures

`npm test` (alias: `npm run fixtures`) builds the CLI and asserts golden exit codes.

| Set | Count | Expected |
|-----|-------|----------|
| `fixtures/pass/*` | 3 TS (complexity + cognitive) + 1 Python (lizard) | exit 0 |
| `fixtures/fail/fail-cyclo-*` | 3 TS + 1 Python | `complexity` → exit 1 |
| `fixtures/fail/fail-cog-*` | 3 TS | `cognitive` → exit 1 |
| `fixtures/arch/pass-*` | 3 module graphs | `arch` → exit 0 |
| `fixtures/arch/fail-*` | 3 module graphs | `arch` → exit 1 |
| `test/broken/*` | invalid JSON / max / tools / missing arch config | exit 2 |

Labels live in the filenames and directory names. See `fixtures/README.md`.

## Licensing

- **agent-lint** source: MIT
- **lizard**: MIT (`pip install lizard`)
- **ESLint** and `@typescript-eslint/parser`: MIT
- **dependency-cruiser**: MIT
- **eslint-plugin-sonarjs**: **LGPL-3.0-only**

LGPL rules for this repo:

- The plugin is listed as an npm **`devDependency` only**.
- It is loaded with a **dynamic import** (`src/runners/load-sonarjs.ts`). We do **not** statically bundle it into a redistributable binary (`pkg`, esbuild `--bundle`, etc.).
- Do not vendor or concatenate the plugin into `dist/`.

If you redistribute a compiled binary of this CLI, keep sonarjs as a separate installable module.

## What this is not

- Not mutation testing, perf benches, or BC detection.
- Not k6. Not a training reward signal.
- Not a claim that low complexity or a green architecture lane equals good design.
- Not a substitute for a human ADR on layering.

## Layout

```
src/            orchestrator (args, config, runners, report)
bin/            node bin/agent-lint.js
templates/      human-owned architecture rule starters
fixtures/       golden pass/fail samples
test/           node:test exit-code assertions
```
