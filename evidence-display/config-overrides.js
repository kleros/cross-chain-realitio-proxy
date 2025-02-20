// const nodeExternals = require("webpack-node-externals");
const webpack = require("webpack");

module.exports = {
  webpack: (config, _) => {
    config.plugins = [
      ...config.plugins,
      new webpack.DefinePlugin({
        "process.env.VERSION": JSON.stringify(process.env.npm_package_version),
      }),
    ];
    return config;
  },
};
