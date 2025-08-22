const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: path.resolve(__dirname, 'src/main.tsx'),
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'assets/[name].[contenthash].js',
    chunkFilename: 'assets/[name].[contenthash].js',
    publicPath: '/',
    clean: true
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx'],
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),

      // 🔒 also lock the JSX runtimes to the same react
      'react/jsx-runtime': path.resolve(__dirname, 'node_modules/react/jsx-runtime.js'),
      'react/jsx-dev-runtime': path.resolve(__dirname, 'node_modules/react/jsx-dev-runtime.js'),

      // (optional, but sometimes helps bundlers pick the same entry)
      'react-dom/client': path.resolve(__dirname, 'node_modules/react-dom/client.js'),
    }
  },
  module: {
    rules: [
      { test: /\.[jt]sx?$/, use: 'babel-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader','css-loader','postcss-loader'] }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({ template: path.resolve(__dirname, 'index.html') })
  ],
  devtool: false,
  devServer: {
    host: '0.0.0.0',
    port: 5173,
    historyApiFallback: true,
    proxy: { '/api': 'http://localhost:8080' } // for dev only
  }
};

