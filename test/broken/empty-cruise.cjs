module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    includeOnly: "^this-matches-nothing/",
    doNotFollow: { path: "node_modules" },
  },
};
