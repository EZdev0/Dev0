module.exports = {
  extends: ["expo"],
  ignorePatterns: ["dist/*", "node_modules/*"],
  rules: {
    "import/no-unresolved": "off",
    "import/namespace": "off",
  },
  overrides: [
    {
      files: ["scripts/**/*.js", "*.js"],
      env: {
        node: true,
      },
    },
  ],
};
