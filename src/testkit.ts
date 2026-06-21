// Minimal Vitest-compatible shim over Node's built-in test runner, so the engine
// and persistence suites run with zero npm dependencies (the dev npm proxy here
// cannot serve vite, which vitest depends on). Swap test imports back to 'vitest'
// once a working registry is available.
import { test, describe as nodeDescribe, beforeEach as nodeBeforeEach } from 'node:test';
import assert from 'node:assert/strict';

// In-memory localStorage for persistence tests. Node exposes a non-functional
// stub global, so force-install whenever a usable `clear` is absent.
function needsLocalStoragePolyfill(): boolean {
  try {
    const ls = (globalThis as { localStorage?: { clear?: unknown } }).localStorage;
    return !ls || typeof ls.clear !== 'function';
  } catch {
    return true;
  }
}
if (needsLocalStoragePolyfill()) {
  const store = new Map<string, string>();
  const polyfill = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      value: polyfill,
      configurable: true,
      writable: true,
    });
  } catch {
    (globalThis as { localStorage?: unknown }).localStorage = polyfill;
  }
}

type Fn = () => void | Promise<void>;

export function it(name: string, fn: Fn): void {
  test(name, fn);
}
export function describe(name: string, fn: Fn): void {
  nodeDescribe(name, fn);
}
export const beforeEach = nodeBeforeEach;

class Expectation {
  private actual: unknown;
  constructor(actual: unknown) {
    this.actual = actual;
  }
  toBe(e: unknown) {
    assert.strictEqual(this.actual, e);
  }
  toEqual(e: unknown) {
    assert.deepStrictEqual(this.actual, e);
  }
  toBeGreaterThan(e: number) {
    assert.ok((this.actual as number) > e, `expected ${this.actual} > ${e}`);
  }
  toBeLessThan(e: number) {
    assert.ok((this.actual as number) < e, `expected ${this.actual} < ${e}`);
  }
  toBeGreaterThanOrEqual(e: number) {
    assert.ok((this.actual as number) >= e, `expected ${this.actual} >= ${e}`);
  }
  toBeLessThanOrEqual(e: number) {
    assert.ok((this.actual as number) <= e, `expected ${this.actual} <= ${e}`);
  }
  toBeNull() {
    assert.strictEqual(this.actual, null);
  }
  toHaveLength(n: number) {
    assert.strictEqual((this.actual as { length: number }).length, n);
  }
  toThrow() {
    assert.throws(this.actual as Fn);
  }
}

export function expect(actual: unknown): Expectation {
  return new Expectation(actual);
}
