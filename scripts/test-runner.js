const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const Module = require('module');

global.__DEV__ = false;
const memoryStorage = new Map();

// Mock react-native, async-storage, expo-file-system, and handle @/ alias for node testing
const origRequire = Module.prototype.require;
Module.prototype.require = function (id) {
  if (id === 'react-native') {
    return {
      Platform: { OS: 'web' },
      Alert: { alert: console.log },
      StyleSheet: { create: (s) => s },
    };
  }
  if (id === 'expo-file-system') {
    return {
      documentDirectory: '/mock-docs/',
      getInfoAsync: async () => ({ exists: false }),
      makeDirectoryAsync: async () => {},
      readAsStringAsync: async () => '[]',
      writeAsStringAsync: async () => {},
    };
  }
  if (id === '@react-native-async-storage/async-storage') {
    return {
      default: {
        getItem: async (k) => memoryStorage.get(k) ?? null,
        setItem: async (k, v) => { memoryStorage.set(k, v); },
        removeItem: async (k) => { memoryStorage.delete(k); },
      },
      getItem: async (k) => memoryStorage.get(k) ?? null,
      setItem: async (k, v) => { memoryStorage.set(k, v); },
      removeItem: async (k) => { memoryStorage.delete(k); },
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
let currentBeforeEach = null;
const testQueue = [];

global.beforeEach = (fn) => {
  currentBeforeEach = fn;
};

global.describe = (name, fn) => {
  const prevSuite = currentSuite;
  const prevBeforeEach = currentBeforeEach;
  currentSuite = prevSuite ? `${prevSuite} > ${name}` : name;
  testQueue.push({ type: 'suite', name: currentSuite });
  try {
    fn();
  } catch (e) {
    console.error(`💥 Suite definition failed: ${name}`, e);
    failed++;
  }
  currentSuite = prevSuite;
  currentBeforeEach = prevBeforeEach;
};

global.it = (name, fn) => {
  testQueue.push({ type: 'test', suite: currentSuite, name, fn, beforeEachFn: currentBeforeEach });
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

// 1. Load web-tools test
require('../__tests__/utils/web-tools.test.ts');

// 2. Load chat-compression test
require('../__tests__/utils/chat-compression.test.ts');

// 3. Load multi-agent & AI fallback / learning guard test
require('../__tests__/utils/multi-agent.test.ts');

// 4. Load Synapse Graph, YAML Skill Loader, Free AI Key Pool & 3-Tier Tool Parser test
require('../__tests__/utils/synapse-and-pool.test.ts');

// 5. Load Strict Question Tool, Sub-Agent Floating Window Relay & Extended Free Pool test
require('../__tests__/utils/subagent-question-and-pool.test.ts');

// 6. Load Dev0 v1.6 Chat ZIP, Cross-Chat Reader, Dual Git Restore, Standalone Memory Graph & Tool Isolation test
require('../__tests__/utils/v16-chat-zip-git-memory-graph.test.ts');

(async () => {
  for (const item of testQueue) {
    if (item.type === 'suite') {
      console.log(`\n📁 ${item.name}`);
      continue;
    }
    try {
      if (item.beforeEachFn) {
        await item.beforeEachFn();
      }
      await item.fn();
      passed++;
      console.log(`  ✅ ${item.name}`);
    } catch (e) {
      failed++;
      console.error(`  ❌ ${item.name}:`, e && e.message ? e.message : e);
    }
  }

  console.log(`\n========================================`);
  console.log(`Tests passed: ${passed}, Tests failed: ${failed}`);
  console.log(`========================================`);
  if (failed > 0) process.exit(1);
})();
