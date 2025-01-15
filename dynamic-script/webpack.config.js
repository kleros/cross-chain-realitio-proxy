const path = require("path");
const Dotenv = require("dotenv-webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = {
  mode: "production",
  entry: "./src/index.js",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "realitio-dynamic-script-v" + process.env.npm_package_version + ".js",
    libraryTarget: "var",
    library: "getMetaEvidence",
  },
  plugins: [
    new CleanWebpackPlugin(),
    new Dotenv({
      safe: true,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
};
