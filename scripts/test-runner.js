const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

// Mock react-native for node testing
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'react-native') {
    return {
      Platform: { OS: 'web' },
      Alert: { alert: console.log },
      StyleSheet: { create: (s) => s },
    };
  }
  return origRequire.apply(this, arguments);
};

let passed = 0;
let failed = 0;
let currentSuite = '';

global.describe = (name, fn) => {
  const prevSuite = currentSuite;
  currentSuite = prevSuite ? `${prevSuite} > ${name}` : name;
  console.log(`\n📁 ${currentSuite}`);
  try {
    fn();
  } catch (e) {
    console.error(`💥 Suite failed: ${name}`, e);
  }
  currentSuite = prevSuite;
};

global.it = (name, fn) => {
  try {
    const res = fn();
    if (res && typeof res.then === 'function') {
      res
        .then(() => {
          passed++;
          console.log(`  ✅ ${name}`);
        })
        .catch(e => {
          failed++;
          console.error(`  ❌ ${name}:`, e.message);
        });
    } else {
      passed++;
      console.log(`  ✅ ${name}`);
    }
  } catch (e) {
    failed++;
    console.error(`  ❌ ${name}:`, e.message);
  }
};

global.test = global.it;

global.expect = (actual) => ({
  toBe: (expected) => {
    if (actual !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  },
  toEqual: (expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  },
  toBeDefined: () => {
    if (actual === undefined) throw new Error('Expected value to be defined');
  },
  toBeUndefined: () => {
    if (actual !== undefined) throw new Error('Expected value to be undefined');
  },
  toBeTruthy: () => {
    if (!actual) throw new Error(`Expected truthy but got ${actual}`);
  },
  toBeFalsy: () => {
    if (actual) throw new Error(`Expected falsy but got ${actual}`);
  },
  toBeGreaterThan: (expected) => {
    if (!(actual > expected)) throw new Error(`Expected ${actual} > ${expected}`);
  },
  toBeGreaterThanOrEqual: (expected) => {
    if (!(actual >= expected)) throw new Error(`Expected ${actual} >= ${expected}`);
  },
  toBeLessThan: (expected) => {
    if (!(actual < expected)) throw new Error(`Expected ${actual} < ${expected}`);
  },
  toBeLessThanOrEqual: (expected) => {
    if (!(actual <= expected)) throw new Error(`Expected ${actual} <= ${expected}`);
  },
  toContain: (item) => {
    if (typeof actual === 'string') {
      if (!actual.includes(item)) throw new Error(`Expected "${actual}" to contain "${item}"`);
    } else if (Array.isArray(actual)) {
      if (!actual.includes(item)) throw new Error(`Expected array to contain ${item}`);
    }
  },
  toHaveLength: (len) => {
    if (actual?.length !== len) throw new Error(`Expected length ${len} but got ${actual?.length}`);
  },
});

require.extensions['.ts'] = function (module, filename) {
  const content = fs.readFileSync(filename, 'utf8');
  const compiled = ts.transpileModule(content, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  module._compile(compiled.outputText, filename);
};

console.log('--- Running Test Suites ---');

// 1. Run web-tools test
require('../__tests__/utils/web-tools.test.ts');

// 2. Run chat-compression test
require('../__tests__/utils/chat-compression.test.ts');

setTimeout(() => {
  console.log(`\n========================================`);
  console.log(`Tests passed: ${passed}, Tests failed: ${failed}`);
  console.log(`========================================`);
  if (failed > 0) process.exit(1);
}, 2500);
