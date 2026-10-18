const fs = require('fs');
const path = require('path');

const mjsPath = path.join(__dirname, '..', 'node_modules', '@ai-sdk', 'provider-utils', 'dist', 'index.mjs');
const jsPath = path.join(__dirname, '..', 'node_modules', '@ai-sdk', 'provider-utils', 'dist', 'index.js');

function patchFile(file) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    // Replace the problematic importNodeModule implementation
    content = content.replace(/function importNodeModule\(id\) \{\s*return import\(id\);\s*\}/g, 'function importNodeModule(id) { return Promise.reject(new Error("Dynamic import not supported in Metro")); }');
    fs.writeFileSync(file, content, 'utf8');
    console.log('Patched', file);
  }
}

patchFile(mjsPath);
patchFile(jsPath);

// Patch expo metro-runtime error overlay
const logContextPath = path.join(__dirname, '..', 'node_modules', '@expo', 'metro-runtime', 'src', 'error-overlay', 'Data', 'LogContext.tsx');
if (fs.existsSync(logContextPath)) {
  let content = fs.readFileSync(logContextPath, 'utf8');
  content = content.replace(/logs: raw\.logs\.map/g, 'logs: (raw.logs || []).map');
  fs.writeFileSync(logContextPath, content, 'utf8');
  console.log('Patched', logContextPath);
}

// Patch toolkit-sdk agent.js to allow fetch and api overrides
const sdkAgentPaths = [
  path.join(__dirname, '..', 'node_modules', '@rork-ai', 'toolkit-sdk', 'lib', 'module', 'agent.js'),
  path.join(__dirname, '..', 'node_modules', '@rork-ai', 'toolkit-sdk', 'lib', 'commonjs', 'agent.js')
];

for (const p of sdkAgentPaths) {
  if (fs.existsSync(p)) {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(
      /transport: new (?:_ai\.)?DefaultChatTransport\(\{[\s\S]*?fetch: expoFetch,[\s\S]*?api: AGENT_URL,/g,
      'transport: options.transport || new DefaultChatTransport({ fetch: options.fetch || expoFetch, api: options.api || AGENT_URL,'
    );
    // Also patch for commonjs which might not have _ai. or expoFetch
    content = content.replace(
      /transport: new (?:_ai\.)?DefaultChatTransport\(\{\s*fetch: (?:_fetch\.)?fetch,\s*api: AGENT_URL,/g,
      'transport: options.transport || new DefaultChatTransport({ fetch: options.fetch || expoFetch, api: options.api || AGENT_URL,'
    );
    
    // More generic replace just in case
    content = content.replace(
      /transport: new (.*?)\.DefaultChatTransport\(\{([\s\S]*?)fetch: (.*?),([\s\S]*?)api: (.*?),/g,
      'transport: options.transport || new $1.DefaultChatTransport({$2fetch: options.fetch || $3,$4api: options.api || $5,'
    );

    fs.writeFileSync(p, content, 'utf8');
    console.log('Patched', p);
  }
}

// Patch agent.d.ts
const dtsPath = path.join(__dirname, '..', 'node_modules', '@rork-ai', 'toolkit-sdk', 'lib', 'typescript', 'src', 'agent.d.ts');
if (fs.existsSync(dtsPath)) {
  let content = fs.readFileSync(dtsPath, 'utf8');
  if (!content.includes('fetch?:')) {
    content = content.replace(
      /useRorkAgent<T extends Record<string, Tool<z.ZodType>>>\(options: Omit<UseChatOptions<UIMessage>, "transport"> & \{/g,
      'useRorkAgent<T extends Record<string, Tool<z.ZodType>>>(options: Omit<UseChatOptions<UIMessage>, "transport"> & { fetch?: any; api?: string; '
    );
    fs.writeFileSync(dtsPath, content, 'utf8');
    console.log('Patched', dtsPath);
  }
}

// Patch image-size to maintain compatibility with Metro string file paths
const imageSizeCjsPath = path.join(__dirname, '..', 'node_modules', 'image-size', 'dist', 'cjs', 'lookup.js');
if (fs.existsSync(imageSizeCjsPath)) {
  let content = fs.readFileSync(imageSizeCjsPath, 'utf8');
  if (!content.includes('typeof input === \'string\'')) {
    content = content.replace(
      'function imageSize(input) {',
      'function imageSize(input) {\n    if (typeof input === \'string\') {\n        input = require(\'fs\').readFileSync(input);\n    }'
    );
    fs.writeFileSync(imageSizeCjsPath, content, 'utf8');
    console.log('Patched', imageSizeCjsPath);
  }
}

// Patch metro Assets.js to safely read file before imageSize
const metroAssetsPath = path.join(__dirname, '..', 'node_modules', 'metro', 'src', 'Assets.js');
if (fs.existsSync(metroAssetsPath)) {
  let content = fs.readFileSync(metroAssetsPath, 'utf8');
  if (content.includes(': assetInfo.files[0];')) {
    content = content.replace(
      ': assetInfo.files[0];',
      ': _fs.default.readFileSync(assetInfo.files[0]);'
    );
    fs.writeFileSync(metroAssetsPath, content, 'utf8');
    console.log('Patched', metroAssetsPath);
  }
}

// Patch image-size index.js to maintain CommonJS default function compatibility
const imageSizeIndexPath = path.join(__dirname, '..', 'node_modules', 'image-size', 'dist', 'cjs', 'index.js');
if (fs.existsSync(imageSizeIndexPath)) {
  let content = fs.readFileSync(imageSizeIndexPath, 'utf8');
  if (!content.includes('module.exports = lookup_1.imageSize;')) {
    content += '\nmodule.exports = lookup_1.imageSize;\nmodule.exports.default = lookup_1.imageSize;\nmodule.exports.imageSize = lookup_1.imageSize;\nmodule.exports.disableTypes = lookup_1.disableTypes;\nmodule.exports.types = types_1.types;\nmodule.exports.__esModule = true;\n';
    fs.writeFileSync(imageSizeIndexPath, content, 'utf8');
    console.log('Patched', imageSizeIndexPath);
  }
}

// Create comprehensive shims for expo-router/internal/* for full compatibility with @expo/router-server
const expoRouterDir = path.join(__dirname, '..', 'node_modules', 'expo-router');
if (fs.existsSync(expoRouterDir)) {
  const internalDir = path.join(expoRouterDir, 'internal');
  if (!fs.existsSync(internalDir)) {
    fs.mkdirSync(internalDir, { recursive: true });
  }

  function createShim(name, code) {
    const filePath = path.join(internalDir, name + '.js');
    const dirPath = path.join(internalDir, name);
    const indexPath = path.join(dirPath, 'index.js');
    fs.writeFileSync(filePath, code, 'utf8');
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    fs.writeFileSync(indexPath, code, 'utf8');
    console.log('Created shim', filePath);
  }

  // 1. expo-router/internal/static
  createShim('static', `"use strict";
// Auto-generated shim for expo-router/internal/static compatibility
const renderStatic = require('../build/static/renderStaticContent');
module.exports = {
  ...renderStatic,
  default: renderStatic,
  registerStaticRootComponent: (Component, props) => {
    try {
      const { AppRegistry } = require('react-native-web');
      return AppRegistry.getApplication('App', { initialProps: props });
    } catch (e) {
      return { element: null, getStyleElement: () => null };
    }
  },
  InnerRoot: ({ children }) => children,
};
`);

  // 2. expo-router/internal/routing
  createShim('routing', `"use strict";
// Auto-generated shim for expo-router/internal/routing compatibility
const getRoutesMod = require('../build/getRoutes');
const getRoutesCoreMod = require('../build/getRoutesCore');
const getReactNavigationConfigMod = require('../build/getReactNavigationConfig');
const matchersMod = require('../build/matchers');
const sortRoutesMod = require('../build/sortRoutes');
const loadStaticParamsMod = require('../build/loadStaticParamsAsync');

module.exports = {
  ...getRoutesMod,
  ...getRoutesCoreMod,
  ...getReactNavigationConfigMod,
  ...matchersMod,
  ...sortRoutesMod,
  ...loadStaticParamsMod,
  getRoutes: getRoutesMod.getRoutes || getRoutesCoreMod.getRoutes,
  getRoutesCore: getRoutesCoreMod.getRoutesCore || getRoutesCoreMod.getRoutes,
  getExactRoutes: getRoutesMod.getExactRoutes || getRoutesMod.getRoutes,
  generateDynamic: getRoutesMod.generateDynamic,
  extrapolateGroups: getRoutesMod.extrapolateGroups,
  getReactNavigationConfig: getReactNavigationConfigMod.getReactNavigationConfig,
  getReactNavigationScreensConfig: getReactNavigationConfigMod.getReactNavigationScreensConfig,
  loadStaticParamsAsync: loadStaticParamsMod.loadStaticParamsAsync,
  matchGroupName: matchersMod.matchGroupName,
  matchDynamicName: matchersMod.matchDynamicName,
  getContextKey: matchersMod.getContextKey,
  removeSupportedExtensions: matchersMod.removeSupportedExtensions,
  isTypedRoute: matchersMod.isTypedRoute,
  sortRoutes: sortRoutesMod.sortRoutes,
};
module.exports.default = module.exports;
`);

  // 3. expo-router/internal/utils
  createShim('utils', `"use strict";
// Auto-generated shim for expo-router/internal/utils compatibility
const urlUtils = require('../build/utils/url');
module.exports = {
  ...urlUtils,
  shouldLinkExternally: urlUtils.shouldLinkExternally || (() => false),
};
module.exports.default = module.exports;
`);

  // 4. expo-router/internal/server
  createShim('server', `"use strict";
// Auto-generated shim for expo-router/internal/server compatibility
module.exports = {
  ServerDocument: ({ children }) => children,
};
module.exports.default = module.exports;
`);

  // 5. expo-router/internal/rsc
  createShim('rsc', `"use strict";
// Auto-generated shim for expo-router/internal/rsc compatibility
module.exports = {
  decodeActionId: (id) => id,
  Children: ({ children }) => children,
  LOCATION_ID: 'location',
  PARAM_KEY_SKIP: 'skip',
  SHOULD_SKIP_ID: 'should_skip',
  ServerRouter: ({ children }) => children,
  Slot: ({ children }) => children,
  getComponentIds: () => [],
  getInputString: () => '',
  parseInputString: () => ({}),
};
module.exports.default = module.exports;
`);

  // 6. expo-router/internal/testing
  createShim('testing', `"use strict";
module.exports = {
  requireContext: () => () => null,
  inMemoryContext: () => () => null,
};
module.exports.default = module.exports;
`);
}

// Recursively find and patch any @expo/router-server instance if present
function findAndPatchRouterServer(currentDir) {
  if (!fs.existsSync(currentDir)) return;
  try {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '@expo' || entry.name === 'expo' || entry.name === '@expo/cli' || entry.name === 'router-server' || entry.name === 'build' || entry.name === 'static' || entry.name === 'node') {
          findAndPatchRouterServer(fullPath);
        }
      } else if (entry.isFile()) {
        // Direct override of @expo/router-server render entrypoints to expo-router
        if (fullPath.includes('@expo') && fullPath.includes('router-server')) {
          if (entry.name === 'render.js' && fullPath.includes('node')) {
            fs.writeFileSync(fullPath, "// Redirected to expo-router native renderer\nmodule.exports = require('expo-router/build/static/renderStaticContent');\n", 'utf8');
            console.log('Redirected router-server render.js at', fullPath);
          } else if (entry.name === 'renderStaticContent.js') {
            fs.writeFileSync(fullPath, "// Redirected to expo-router native renderer\nmodule.exports = require('expo-router/build/static/renderStaticContent');\n", 'utf8');
            console.log('Redirected router-server renderStaticContent.js at', fullPath);
          } else if (entry.name === 'getServerManifest.js' && fullPath.includes('static')) {
            fs.writeFileSync(fullPath, "// Redirected to expo-router getServerManifest\nmodule.exports = require('expo-router/build/static/getServerManifest');\n", 'utf8');
            console.log('Redirected router-server getServerManifest.js at', fullPath);
          } else if (entry.name.endsWith('.js')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;
            if (content.includes('require("expo-router/internal/static")')) {
              content = content.replace(/require\(["']expo-router\/internal\/static["']\)/g, 'require("expo-router/build/static/renderStaticContent")');
              modified = true;
            }
            if (content.includes('require("expo-router/internal/routing")')) {
              content = content.replace(/require\(["']expo-router\/internal\/routing["']\)/g, 'require("expo-router/internal/routing")');
              modified = true;
            }
            if (modified) {
              fs.writeFileSync(fullPath, content, 'utf8');
              console.log('Patched router-server at', fullPath);
            }
          }
        }
      }
    }
  } catch (err) {
    // Ignore permissions or directory errors
  }
}
const nodeModulesRoot = path.join(__dirname, '..', 'node_modules');
findAndPatchRouterServer(nodeModulesRoot);



