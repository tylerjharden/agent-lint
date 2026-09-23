module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-domain-to-ui",
      severity: "error",
      from: { path: "(^|/)domain/" },
      to: { path: "(^|/)ui/" },
    },
    {
      name: "no-domain-to-app",
      severity: "error",
      from: { path: "(^|/)domain/" },
      to: { path: "(^|/)app/" },
    },
    {
      name: "no-app-to-ui",
      severity: "error",
      from: { path: "(^|/)app/" },
      to: { path: "(^|/)ui/" },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
  },
};
