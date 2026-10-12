const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

// Mock react-native and handle @/ alias for node testing
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'react-native') {
    return {
      Platform: { OS: 'web' },
      Alert: { alert: console.log },
      StyleSheet: { create: (s) => s },
    };
  }
  if (id.startsWith('@/')) {
    const resolvedPath = path.resolve(__dirname, '..', id.slice(2));
    return origRequire.call(this, resolvedPath);
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

const createMatchers = (actual, isNot = false) => ({
  toBe: (expected) => {
    const pass = actual === expected;
    if (isNot ? pass : !pass) throw new Error(`Expected ${JSON.stringify(actual)} ${isNot ? 'not to be' : 'to be'} ${JSON.stringify(expected)}`);
  },
  toEqual: (expected) => {
    const pass = JSON.stringify(actual) === JSON.stringify(expected);
    if (isNot ? pass : !pass) throw new Error(`Expected ${JSON.stringify(actual)} ${isNot ? 'not to equal' : 'to equal'} ${JSON.stringify(expected)}`);
  },
  toBeDefined: () => {
    const pass = actual !== undefined;
    if (isNot ? pass : !pass) throw new Error(`Expected value ${isNot ? 'not ' : ''}to be defined`);
  },
  toBeUndefined: () => {
    const pass = actual === undefined;
    if (isNot ? pass : !pass) throw new Error(`Expected value ${isNot ? 'not ' : ''}to be undefined`);
  },
  toBeTruthy: () => {
    const pass = !!actual;
    if (isNot ? pass : !pass) throw new Error(`Expected ${isNot ? 'falsy' : 'truthy'} but got ${actual}`);
  },
  toBeFalsy: () => {
    const pass = !actual;
    if (isNot ? pass : !pass) throw new Error(`Expected ${isNot ? 'truthy' : 'falsy'} but got ${actual}`);
  },
  toBeGreaterThan: (expected) => {
    const pass = actual > expected;
    if (isNot ? pass : !pass) throw new Error(`Expected ${actual} ${isNot ? 'not >' : '>'} ${expected}`);
  },
  toBeGreaterThanOrEqual: (expected) => {
    const pass = actual >= expected;
    if (isNot ? pass : !pass) throw new Error(`Expected ${actual} ${isNot ? 'not >=' : '>='} ${expected}`);
  },
  toBeLessThan: (expected) => {
    const pass = actual < expected;
    if (isNot ? pass : !pass) throw new Error(`Expected ${actual} ${isNot ? 'not <' : '<'} ${expected}`);
  },
  toBeLessThanOrEqual: (expected) => {
    const pass = actual <= expected;
    if (isNot ? pass : !pass) throw new Error(`Expected ${actual} ${isNot ? 'not <=' : '<='} ${expected}`);
  },
  toContain: (item) => {
    let pass = false;
    if (typeof actual === 'string') {
      pass = actual.includes(item);
    } else if (Array.isArray(actual)) {
      pass = actual.includes(item);
    }
    if (isNot ? pass : !pass) throw new Error(`Expected ${JSON.stringify(actual)} ${isNot ? 'not to contain' : 'to contain'} ${JSON.stringify(item)}`);
  },
  toHaveLength: (len) => {
    const pass = actual?.length === len;
    if (isNot ? pass : !pass) throw new Error(`Expected length ${len} but got ${actual?.length}`);
  },
});

global.expect = (actual) => ({
  ...createMatchers(actual, false),
  not: createMatchers(actual, true),
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

// 3. Run multi-agent test
require('../__tests__/utils/multi-agent.test.ts');

setTimeout(() => {
  console.log(`\n========================================`);
  console.log(`Tests passed: ${passed}, Tests failed: ${failed}`);
  console.log(`========================================`);
  if (failed > 0) process.exit(1);
}, 2500);
