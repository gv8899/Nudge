import { describe, it, expect } from 'vitest';
import { extractIcuPlaceholders, buildArbJson } from './transpile.mjs';

describe('extractIcuPlaceholders', () => {
  it('extracts simple {name} placeholders', () => {
    expect(extractIcuPlaceholders('Hello {name}!')).toEqual(['name']);
  });

  it('extracts multiple placeholders', () => {
    expect(extractIcuPlaceholders('{a} and {b}')).toEqual(['a', 'b']);
  });

  it('extracts placeholder from plural with #', () => {
    const s = '{count, plural, one{# card} other{# cards}}';
    expect(extractIcuPlaceholders(s)).toEqual(['count']);
  });

  it('deduplicates repeated placeholders', () => {
    expect(extractIcuPlaceholders('{x} {x}')).toEqual(['x']);
  });

  it('returns empty for plain strings', () => {
    expect(extractIcuPlaceholders('Hello world')).toEqual([]);
  });
});

describe('buildArbJson', () => {
  it('produces ARB with @@locale and @key metadata for params', () => {
    const flat = {
      settingsTitle: '設定',
      cardsDeleted: '已清除 {count} 張空白卡片',
    };
    const result = buildArbJson(flat, 'zh');
    expect(result['@@locale']).toBe('zh');
    expect(result['settingsTitle']).toBe('設定');
    expect(result['@settingsTitle']).toEqual({});
    expect(result['cardsDeleted']).toBe('已清除 {count} 張空白卡片');
    expect(result['@cardsDeleted']).toEqual({
      placeholders: { count: { type: 'Object' } },
    });
  });

  it('extracts placeholder from plural format', () => {
    const flat = { cardCount: '{count, plural, other{# 張}}' };
    const result = buildArbJson(flat, 'zh');
    expect(result['@cardCount']).toEqual({
      placeholders: { count: { type: 'num' } },
    });
  });
});
