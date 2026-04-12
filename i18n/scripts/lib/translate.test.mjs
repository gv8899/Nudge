import { describe, it, expect, vi } from 'vitest';
import { translateIncremental } from './translate.mjs';

describe('translateIncremental', () => {
  it('returns empty when no keys to translate', async () => {
    const fakeClient = { messages: { create: vi.fn() } };
    const result = await translateIncremental({
      client: fakeClient,
      source: { 'a.b': '你好' },
      targetLang: 'en',
      keysToTranslate: [],
    });
    expect(result).toEqual({});
    expect(fakeClient.messages.create).not.toHaveBeenCalled();
  });

  it('parses Claude JSON response', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            { type: 'text', text: '{"a.b": "Hello", "c.d": "World"}' },
          ],
        }),
      },
    };
    const result = await translateIncremental({
      client: fakeClient,
      source: { 'a.b': '你好', 'c.d': '世界' },
      targetLang: 'en',
      keysToTranslate: ['a.b', 'c.d'],
    });
    expect(result).toEqual({ 'a.b': 'Hello', 'c.d': 'World' });
  });

  it('extracts JSON even if wrapped in markdown fence', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: '```json\n{"a": "X"}\n```',
            },
          ],
        }),
      },
    };
    const result = await translateIncremental({
      client: fakeClient,
      source: { a: '甲' },
      targetLang: 'ja',
      keysToTranslate: ['a'],
    });
    expect(result).toEqual({ a: 'X' });
  });

  it('throws if Claude returns invalid JSON', async () => {
    const fakeClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'not json' }],
        }),
      },
    };
    await expect(
      translateIncremental({
        client: fakeClient,
        source: { a: '甲' },
        targetLang: 'en',
        keysToTranslate: ['a'],
      })
    ).rejects.toThrow(/parse/i);
  });
});
