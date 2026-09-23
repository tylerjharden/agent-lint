# Architecture rule templates

These files are **templates**. Copy one into the project, point `architecture.config` at it, and edit the rules after a human ADR.

agent-lint wraps [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) (MIT). It does not own a graph engine or a second rule language.

## Start

1. Copy `layering.template.cjs` to `.dependency-cruiser.cjs` at the repo root (or another path).
2. Set `architecture.config` in `agent-lint.config.json` to that path.
3. Rename the `ui` / `app` / `domain` prefixes so they match the tree.
4. Run `node bin/agent-lint.js arch src`.

The copy in this folder stays a starter. Do not treat it as the project's architecture decision.
