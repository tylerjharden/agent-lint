/**
 * TEMPLATE. Humans own the real layering rules.
 *
 * Copy this file to `.dependency-cruiser.cjs` (or another path) and edit it
 * after an architecture ADR. agent-lint wraps dependency-cruiser. It does
 * not invent a second rule language.
 *
 * Starter idea (change the folder names to match the repo):
 *   ui    may import app
 *   app   may import domain
 *   domain must not import ui or app
 *   app   must not import ui
 *
 * See https://github.com/sverweij/dependency-cruiser/blob/main/doc/rules-reference.md
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "TEMPLATE: circular dependencies. Keep or drop after the ADR.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-domain-to-ui",
      comment: "TEMPLATE: domain must not import ui. Rename the path prefixes.",
      severity: "error",
      from: { path: "(^|/)domain/" },
      to: { path: "(^|/)ui/" },
    },
    {
      name: "no-domain-to-app",
      comment: "TEMPLATE: domain must not import app. Rename the path prefixes.",
      severity: "error",
      from: { path: "(^|/)domain/" },
      to: { path: "(^|/)app/" },
    },
    {
      name: "no-app-to-ui",
      comment: "TEMPLATE: app must not import ui. Rename the path prefixes.",
      severity: "error",
      from: { path: "(^|/)app/" },
      to: { path: "(^|/)ui/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
