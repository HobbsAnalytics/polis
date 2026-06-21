import { describe, it, expect } from '../testkit.ts';

describe('smoke', () => {
  it('arithmetic works', () => {
    expect(1 + 1).toBe(2);
  });
});
