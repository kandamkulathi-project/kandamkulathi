const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// Keep parallel bundling reasonable on the team's development laptops and CI runners.
config.maxWorkers = 2;
module.exports = config;
