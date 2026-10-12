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

