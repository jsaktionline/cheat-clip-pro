import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STUDIO_PREFS,
  STUDIO_PREFS_KEY,
  getSavedStudioPreferences,
} from './preferences';

describe('getSavedStudioPreferences', () => {
  it('returns an empty object when nothing is stored', () => {
    expect(getSavedStudioPreferences()).toEqual({});
  });

  it('parses a stored preference object', () => {
    localStorage.setItem(
      STUDIO_PREFS_KEY,
      JSON.stringify({ aspectRatio: '1:1', bgmVolume: 50 }),
    );

    expect(getSavedStudioPreferences()).toEqual({ aspectRatio: '1:1', bgmVolume: 50 });
  });

  it('ignores malformed JSON', () => {
    localStorage.setItem(STUDIO_PREFS_KEY, '{not json');
    expect(getSavedStudioPreferences()).toEqual({});
  });

  it.each(['null', '[]', '"string"', '42'])(
    'rejects non-object payloads: %s',
    (payload) => {
      localStorage.setItem(STUDIO_PREFS_KEY, payload);
      expect(getSavedStudioPreferences()).toEqual({});
    },
  );

  it('exposes sane defaults for every persisted key', () => {
    expect(DEFAULT_STUDIO_PREFS.aspectRatio).toBeTruthy();
    expect(DEFAULT_STUDIO_PREFS.renderMode).toBe('separate');
    expect(DEFAULT_STUDIO_PREFS.originalAudioVolume).toBe(100);
  });
});
