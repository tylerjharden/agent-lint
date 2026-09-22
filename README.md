# agent-lint

Thin Node/TypeScript CLI that **wraps** existing complexity analyzers and normalizes their output into one fail-closed gate.

This is **not** a mega-linter and **not** a wisdom substitute. It reports cyclomatic and cognitive complexity, then exits.

Spike #1 (lanes 1+2): cyclomatic + cognitive. Architecture, mutation, perf, and BC are out of scope.

## Repo

- Package: `agent-lint` (bin: `agent-lint`)
- Origin: [`durden/agent-lint`](https://cursor.com/codebase/durden/agent-lint)
- Clone: `git clone https://origin.cursor.com/git/durden/agent-lint.git`

## Real vs mock

**Real.** `agent-lint` actually invokes:

| Lane | What runs |
|------|-----------|
| Cyclomatic | [lizard](https://github.com/terryyin/lizard) (MIT) **and** ESLint [`complexity`](https://eslint.org/docs/latest/rules/complexity) (MIT) |
| Cognitive | [`eslint-plugin-sonarjs`](https://www.npmjs.com/package/eslint-plugin-sonarjs) `cognitive-complexity` (LGPL-3.0) |

It does **not** invent CCN/cognitive scores, stub the tools, or call an LLM. If lizard or ESLint/sonarjs cannot run, the process exits **2** (never a soft pass).

Lizard parsers can still “soft-fail” on broken syntax (that is lizard’s behavior). We surface a tool crash as exit 2; we do not re-parse the file ourselves.

## Wrap vs own

| We wrap (buy) | We own (thin) |
|---------------|---------------|
| lizard CLI (`python3 -m lizard --csv`) | CLI, config, path/stdin collection |
| ESLint `complexity` | Exit codes `0 / 1 / 2` |
| sonarjs `cognitive-complexity` | Human / JSON / SARIF normalize |
| | Optional future diff-scope hook (`src/scope.ts`) |

We do **not** build parsers, a mutation engine, or another Sonar.

## Install

Requires **Node 20+**. Lizard is a separate Python tool (MIT):

```bash
npm install
pip install -r requirements.txt   # lizard
python3 -m lizard --version
npm run build
```

`eslint-plugin-sonarjs` is an **npm devDependency** (see [Licensing](#licensing)). A production install with `--omit=dev` will fail the cognitive lane closed (exit 2) until that plugin is installed.

## How to run

After `npm run build`:

```bash
# default command is "all"
node bin/agent-lint.js all src
node dist/cli.js complexity fixtures/pass
npx agent-lint cognitive src --json

# paths and/or stdin
echo fixtures/pass/pass-01-add.ts | node bin/agent-lint.js --stdin
cat snippet.ts | node bin/agent-lint.js --stdin-code --stdin-file-path snippet.ts

# formats
node bin/agent-lint.js all src --format human
node bin/agent-lint.js all src --json
node bin/agent-lint.js all src --sarif
```

CI-ready invocations (same binary):

```bash
npx agent-lint all src --format json
node bin/agent-lint.js all src --format sarif
node dist/cli.js all src
```

### Commands

| Command | Lanes |
|---------|--------|
| `complexity` | lizard + ESLint `complexity` |
| `cognitive` | sonarjs `cognitive-complexity` |
| `all` (default) | both |

### Exit codes

| Code | Meaning |
|------|---------|
| **0** | Pass — no function over threshold |
| **1** | Fail — threshold breach (or a golden-fail fixture that must fail) |
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
| `cyclomatic.max` | **10** | Tighter than ESLint’s rule default (20) and lizard’s warning default (15). Agent diffs usually want the stricter bar. |
| `cyclomatic.tools` | `["lizard", "eslint"]` | Drop `lizard` only if you explicitly cannot install it. Missing lizard with lizard still listed is exit **2**. |
| `cognitive.max` | **15** | Same as sonarjs’s usual default. |
| `ignore` | `node_modules/**`, `dist/**`, `coverage/**`, `.git/**` | Prefix globs. |

CLI overrides: `--max-cyclomatic <n>` and `--max-cognitive <n>`.

Example `agent-lint.config.json`:

```json
{
  "cyclomatic": { "max": 10, "tools": ["lizard", "eslint"] },
  "cognitive": { "max": 15 },
  "ignore": ["node_modules/**", "dist/**", "fixtures/**"]
}
```

`max` must be a positive integer. Invalid JSON, unknown tools, or a missing `--config` path → exit **2**.

## Fixtures

`npm test` (alias: `npm run fixtures`) builds the CLI and asserts golden exit codes.

| Set | Count | Expected |
|-----|-------|----------|
| `fixtures/pass/*` | 3 TS (both lanes) + 1 Python (lizard) | exit 0 |
| `fixtures/fail/fail-cyclo-*` | 3 TS + 1 Python | `complexity` → exit 1 |
| `fixtures/fail/fail-cog-*` | 3 TS | `cognitive` → exit 1 |
| `test/broken/*` | invalid JSON / max / tools | exit 2 |

Labels live in the filenames (`fail-cyclo-*` vs `fail-cog-*`). See `fixtures/README.md`.

## Licensing

- **agent-lint** source: MIT
- **lizard**: MIT (`pip install lizard`)
- **ESLint** and `@typescript-eslint/parser`: MIT
- **eslint-plugin-sonarjs**: **LGPL-3.0-only**

LGPL rules for this repo:

- The plugin is listed as an npm **`devDependency` only**.
- It is loaded with a **dynamic import** (`src/runners/load-sonarjs.ts`). We do **not** statically bundle it into a redistributable binary (`pkg`, esbuild `--bundle`, etc.).
- Do not vendor or concatenate the plugin into `dist/`.

If you redistribute a compiled binary of this CLI, keep sonarjs as a separate installable module.

## What this is not

- Not architecture lint, mutation testing, perf benches, or BC detection.
- Not k6. Not an LLM reward signal.
- Not a claim that low complexity equals good design.

## Layout

```
src/            orchestrator (args, config, runners, report)
bin/            node bin/agent-lint.js
fixtures/       golden pass/fail samples
test/           node:test exit-code assertions
```
