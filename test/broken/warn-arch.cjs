module.exports = {
  forbidden: [
    {
      name: "ui-to-app-warn",
      severity: "warn",
      comment: "warn does not fail the gate",
      from: { path: "(^|/)ui/" },
      to: { path: "(^|/)app/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
  },
};
