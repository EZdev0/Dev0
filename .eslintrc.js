module.exports = {
  extends: ["expo"],
  ignorePatterns: ["dist/*", "node_modules/*"],
  overrides: [
    {
      files: ["scripts/**/*.js", "*.js"],
      env: {
        node: true,
      },
    },
  ],
};
