export function helpText(): string {
  return `agent-lint — cyclomatic + cognitive + architecture + mutation gates

Usage:
  agent-lint [complexity|cognitive|arch|mutation|all] [paths...] [options]
  agent-lint [paths...]                  # same as "all"
  echo path.ts | agent-lint --stdin      # extra paths from stdin
  cat snippet.ts | agent-lint --stdin-code --stdin-file-path snippet.ts

Commands:
  complexity   Cyclomatic only (lizard + ESLint complexity)
  cognitive    Cognitive only (eslint-plugin-sonarjs)
  arch         Architecture only (dependency-cruiser)
  mutation     Mutation score only (StrykerJS). Alias: mutate
  all          Configured applicable lanes (default)

Options:
  --config <path>              Config file (default: agent-lint.config.json)
  --format human|json|sarif    Output format (default: human)
  --json                       Shortcut for --format json
  --sarif                      Shortcut for --format sarif
  --stdin                      Read extra file paths from stdin (one per line)
  --stdin-code                 Treat stdin as source text, not a path list
  --stdin-file-path <name>     Filename used for --stdin-code (default: stdin.ts)
  --max-cyclomatic <n>         Override cyclomatic max
  --max-cognitive <n>          Override cognitive max
  --help, -h                   Show this help
  --version, -v                Show version

Exit codes:
  0  pass
  1  fail (threshold, architecture rule, or mutation-score breach)
  2  error (tool or config broken — never a soft pass)

Examples:
  npx agent-lint all src
  node bin/agent-lint.js arch src --json
  node dist/cli.js mutation fixtures/mutation/pass-01-add
  node dist/cli.js cognitive src --format sarif
`;
}
