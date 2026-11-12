const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

module.exports = (_env, argv) => ({
  entry: { tab: "./src/tab.tsx" },
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    clean: true
  },
  devtool: argv.mode === "development" ? "inline-source-map" : false,
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    alias: {
      // The SDK package ships separate ESM and CommonJS builds. Our code `import`s it (→ esm/SDK.min.js)
      // while azure-devops-extension-api `require`s it (→ SDK.min.js), so webpack bundled it twice and the
      // second copy threw "The AzureDevOps SDK is already loaded" and never completed the host handshake,
      // leaving every REST call hanging. Pin both to the single CommonJS build.
      "azure-devops-extension-sdk$": path.resolve(__dirname, "node_modules/azure-devops-extension-sdk/SDK.min.js")
    }
  },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: "esbuild-loader", exclude: /node_modules/, options: { tsconfig: "./tsconfig.json" } },
      { test: /\.css$/, use: ["style-loader", "css-loader"] }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({
      filename: "tab.html",
      chunks: ["tab"],
      templateContent: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MD Commenter</title></head>
<body><div id="root"></div></body>
</html>`
    })
  ],
  performance: { hints: false }
});
