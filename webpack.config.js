const path = require('path');

/**@type {import('webpack').Configuration}*/
const config = {
  target: 'node', // VS Code extensions run in a Node.js-context
  mode: 'none', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')

  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'dist'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2'
  },
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    // Add @lydell/node-pty and its binary packages as externals - they are native modules that cannot be bundled
    '@lydell/node-pty': 'commonjs @lydell/node-pty',
    '@lydell/node-pty-linux-x64': 'commonjs @lydell/node-pty-linux-x64',
    '@lydell/node-pty-linux-arm64': 'commonjs @lydell/node-pty-linux-arm64',
    '@lydell/node-pty-darwin-x64': 'commonjs @lydell/node-pty-darwin-x64',
    '@lydell/node-pty-darwin-arm64': 'commonjs @lydell/node-pty-darwin-arm64',
    '@lydell/node-pty-win32-x64': 'commonjs @lydell/node-pty-win32-x64',
    '@lydell/node-pty-win32-arm64': 'commonjs @lydell/node-pty-win32-arm64',
    // Add xterm as external for webview usage
    '@xterm/xterm': 'commonjs @xterm/xterm',
    '@xterm/addon-fit': 'commonjs @xterm/addon-fit'
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader'
          }
        ]
      }
    ]
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log' // enables logging required for problem matchers
  }
};
module.exports = config;
