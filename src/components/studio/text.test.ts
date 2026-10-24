import { describe, expect, it } from 'vitest';

import { applyLetterCase, formatTitleSmart } from './text';

describe('applyLetterCase', () => {
  it.each([
    ['viral pop', 'uppercase', 'VIRAL POP'],
    ['VIRAL POP', 'lowercase', 'viral pop'],
    ['viral pop', 'capitalize', 'Viral Pop'],
  ] as const)('applies %s as %s', (text, style, expected) => {
    expect(applyLetterCase(text, style)).toBe(expected);
  });
});

describe('formatTitleSmart', () => {
  it('returns an empty result for blank input', () => {
    expect(formatTitleSmart('   ', 'capitalize', 'medium')).toEqual({
      formatted: '',
      lineCount: 1,
    });
  });

  it('keeps manual line breaks', () => {
    const result = formatTitleSmart('first line\nsecond line', 'capitalize', 'medium');
    expect(result.formatted).toBe('First Line\nSecond Line');
    expect(result.lineCount).toBe(2);
  });

  it('keeps very short titles on one line', () => {
    expect(formatTitleSmart('Big win', 'capitalize', 'medium')).toEqual({
      formatted: 'Big Win',
      lineCount: 1,
    });
  });

  it('wraps a long title into balanced lines', () => {
    const title = 'this is a very long podcast title that needs to be wrapped across lines';
    const result = formatTitleSmart(title, 'capitalize', 'medium');

    expect(result.lineCount).toBeGreaterThan(1);
    expect(result.lineCount).toBeLessThanOrEqual(4);
    expect(result.formatted.split('\n').length).toBe(result.lineCount);
    // Wrapping must preserve every word (nothing dropped or duplicated).
    expect(result.formatted.toLowerCase().split(/\s+/)).toEqual(title.split(' '));
  });

  it('wraps more aggressively for the big preset', () => {
    const title = 'podcast highlights about startups and product growth';
    const medium = formatTitleSmart(title, 'capitalize', 'medium');
    const big = formatTitleSmart(title, 'capitalize', 'big');

    expect(big.lineCount).toBeGreaterThanOrEqual(medium.lineCount);
  });
});
