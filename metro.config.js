const path = require("path");
try {
  require("./scripts/patch-modules.js");
} catch (_e) {
  // Ignore if patch script already ran
}
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const originalResolveRequest = config.resolver?.resolveRequest;
const rorkLibPath = path.resolve(
  __dirname,
  "node_modules/@rork-ai/toolkit-sdk/lib/module"
);

config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    assert: require.resolve("assert"),
    ...config.resolver?.extraNodeModules,
  },
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === "expo-haptics" && platform === "web") {
      return {
        filePath: path.resolve(rorkLibPath, "polyfills/haptics.web.js"),
        type: "sourceFile",
      };
    }
    if (moduleName === "expo-secure-store" && platform === "web") {
      return {
        filePath: path.resolve(rorkLibPath, "polyfills/secure-store.web.js"),
        type: "sourceFile",
      };
    }
    if (
      moduleName === "react-native-web/dist/exports/RefreshControl" &&
      platform === "web"
    ) {
      return {
        filePath: path.resolve(
          rorkLibPath,
          "polyfills/refresh-control-component.js"
        ),
        type: "sourceFile",
      };
    }
    if (originalResolveRequest) {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;
