// const nodeExternals = require("webpack-node-externals");

module.exports = function override(config) {
  // Modify module rules to handle ES modules
  config.module.rules = config.module.rules.map((rule) => {
    if (rule.oneOf) {
      rule.oneOf = rule.oneOf.map((oneOf) => {
        if (oneOf.test && oneOf.test.toString().includes("mjs")) {
          return {
            ...oneOf,
            type: "javascript/auto",
          };
        }
        return oneOf;
      });
    }
    return rule;
  });

  // Add node polyfills configuration
  config.node = {
    ...config.node,
    fs: "empty",
    path: "empty",
    os: "empty",
  };

  return config;
};
