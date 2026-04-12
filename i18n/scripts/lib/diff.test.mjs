import { describe, it, expect } from 'vitest';
import { flattenDotPath, hashValue, diffCanonical } from './diff.mjs';

describe('flattenDotPath', () => {
  it('flattens nested object to dot-path entries', () => {
    const input = { a: { b: { c: 'hello' }, d: 'world' } };
    const result = flattenDotPath(input);
    expect(result).toEqual({
      'a.b.c': 'hello',
      'a.d': 'world',
    });
  });

  it('handles flat object', () => {
    expect(flattenDotPath({ x: '1', y: '2' })).toEqual({ x: '1', y: '2' });
  });

  it('handles empty object', () => {
    expect(flattenDotPath({})).toEqual({});
  });

  it('throws on non-string leaf', () => {
    expect(() => flattenDotPath({ a: 42 })).toThrow(/non-string leaf/);
  });
});

describe('hashValue', () => {
  it('produces stable SHA256 for same input', () => {
    expect(hashValue('hello')).toBe(hashValue('hello'));
  });

  it('produces different hashes for different inputs', () => {
    expect(hashValue('a')).not.toBe(hashValue('b'));
  });
});

describe('diffCanonical', () => {
  it('detects added keys', () => {
    const v1 = '一';
    const prev = { 'a.b': hashValue(v1) };
    const current = { 'a.b': v1, 'c.d': '二' };
    const result = diffCanonical(prev, current);
    expect(result.added).toEqual(['c.d']);
    expect(result.changed).toEqual([]);
    expect(result.removed).toEqual([]);
  });

  it('detects changed keys by hash', () => {
    const prev = { 'a.b': hashValue('舊值') };
    const current = { 'a.b': '新值' };
    const result = diffCanonical(prev, current);
    expect(result.changed).toEqual(['a.b']);
  });

  it('detects removed keys', () => {
    const prev = { 'a.b': 'h', 'c.d': 'h2' };
    const current = { 'a.b': '一' };
    const result = diffCanonical(prev, current);
    expect(result.removed).toEqual(['c.d']);
  });

  it('treats unchanged keys as neither added/changed/removed', () => {
    const v = '不變';
    const prev = { 'a.b': hashValue(v) };
    const current = { 'a.b': v };
    const result = diffCanonical(prev, current);
    expect(result.added).toEqual([]);
    expect(result.changed).toEqual([]);
    expect(result.removed).toEqual([]);
  });
});
