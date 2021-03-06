const webpack = require('webpack');
const config = require('./webpack.config.js');

config.devtool = 'cheap-module-source-map';
config.watch = true;

config.plugins = config.plugins.concat([
    new webpack.HotModuleReplacementPlugin(),
]);

// Turn off performance hints during development because we don't do any
// splitting or minification in interest of speed. These warnings become
// cumbersome.
config.performance = {
    hints: false,
};

module.exports = config;
