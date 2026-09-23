/**
 * TEMPLATE shipped so `agent-lint all src` has a real rule file.
 *
 * This pack is conservative on purpose:
 *   - no circular dependencies
 *   - src must not import fixtures
 *
 * Copy `templates/architecture/layering.template.cjs` and replace this file
 * after a human ADR. Harsh fail-closed layering is not this default.
 */
module.exports = {
  forbidden: [
    {
      name: "no-circular",
      comment: "TEMPLATE: circular dependencies in the cruised set.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-src-to-fixtures",
      comment: "TEMPLATE: src must not import golden fixtures.",
      severity: "error",
      from: { path: "(^|/)src/" },
      to: { path: "(^|/)fixtures/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default"],
    },
  },
};
