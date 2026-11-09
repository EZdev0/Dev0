const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Prevent Metro file watcher from crashing on transient .bun-tmp-* or .git directories
const existingBlockList = Array.isArray(config.resolver?.blockList)
  ? config.resolver.blockList
  : config.resolver?.blockList
    ? [config.resolver.blockList]
    : [];

config.resolver = {
  ...config.resolver,
  blockList: [
    ...existingBlockList,
    /\/\.bun-tmp-[^/]+/,
    /\/node_modules\/.*\/\.bun-tmp-[^/]+/,
  ],
};

module.exports = config;
