// Type definitions for Jest testing globals
declare var describe: (name: string, fn: () => void) => void;
declare var it: (name: string, fn: () => void | Promise<void>) => void;
declare var test: (name: string, fn: () => void | Promise<void>) => void;
declare var expect: (actual: any) => {
  toBe: (expected: any) => void;
  toEqual: (expected: any) => void;
  toBeDefined: () => void;
  toBeUndefined: () => void;
  toBeTruthy: () => void;
  toBeFalsy: () => void;
  toBeGreaterThan: (expected: number) => void;
  toBeGreaterThanOrEqual: (expected: number) => void;
  toBeLessThan: (expected: number) => void;
  toBeLessThanOrEqual: (expected: number) => void;
  toContain: (item: any) => void;
  toHaveLength: (length: number) => void;
  toThrow: (expected?: any) => void;
  not: any;
};
declare var beforeEach: (fn: () => void | Promise<void>) => void;
declare var afterEach: (fn: () => void | Promise<void>) => void;
declare var beforeAll: (fn: () => void | Promise<void>) => void;
declare var afterAll: (fn: () => void | Promise<void>) => void;
