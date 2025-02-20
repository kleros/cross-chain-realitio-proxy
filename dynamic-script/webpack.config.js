const path = require("path");
const Dotenv = require("dotenv-webpack");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { DefinePlugin } = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");

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
    new DefinePlugin({
      "process.env.VERSION": JSON.stringify(process.env.npm_package_version),
    }),
    new HtmlWebpackPlugin({
      template: "./src/test.html",
      filename: "test.html",
      inject: "head",
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
