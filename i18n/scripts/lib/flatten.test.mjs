import { describe, it, expect } from 'vitest';
import { toCamelCase, buildArbKeyMap } from './flatten.mjs';

describe('toCamelCase', () => {
  it('converts dot-path to camelCase', () => {
    expect(toCamelCase('settings.logout.button')).toBe('settingsLogoutButton');
  });

  it('handles single segment', () => {
    expect(toCamelCase('save')).toBe('save');
  });

  it('handles already-camelCase segments', () => {
    expect(toCamelCase('cards.emptyState')).toBe('cardsEmptyState');
  });

  it('handles underscores inside segments', () => {
    expect(toCamelCase('task.status.in_progress')).toBe('taskStatusInProgress');
  });
});

describe('buildArbKeyMap', () => {
  it('maps canonical dot-path keys to flat camelCase', () => {
    const canonical = {
      'settings.title': '設定',
      'cards.save': '儲存',
    };
    const result = buildArbKeyMap(canonical);
    expect(result).toEqual({
      settingsTitle: '設定',
      cardsSave: '儲存',
    });
  });

  it('detects collisions and throws', () => {
    const canonical = {
      'cards.save': 'A',
      'cardsSave': 'B',
    };
    expect(() => buildArbKeyMap(canonical)).toThrow(/collision/i);
  });
});
