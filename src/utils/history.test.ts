import { describe, expect, it } from 'vitest';

import { readHistoryEntries } from './history';
import type { AnalyzeResponse } from '../types';

function seed(
  payload: Partial<AnalyzeResponse> & { video_id: string },
  keySuffix: string,
  analyzedAt?: string,
) {
  localStorage.setItem(
    `cheat_clip_cache_${payload.video_id}_${keySuffix}`,
    JSON.stringify({
      title: 'Example video',
      duration: 120,
      heatmap: [],
      summary: 'A summary #tag',
      clips: [],
      ...payload,
    }),
  );
  if (analyzedAt) {
    localStorage.setItem(
      `cheat_clip_ts_${payload.video_id}_${keySuffix}`,
      analyzedAt,
    );
  }
}

describe('readHistoryEntries', () => {
  it('builds a YouTube entry with thumbnail, URL and metadata', () => {
    seed(
      {
        video_id: 'dQw4w9WgXcQ',
        title: 'Never gonna give you up',
        clips: [
          { title: 'Clip A', start_time: 0, end_time: 10, virality_score: 90, key_quotes: ['q1'], transcript: '' },
        ],
      },
      '30s',
      '2026-01-01T10:00:00.000Z',
    );

    const [entry] = readHistoryEntries();

    expect(entry).toMatchObject({
      video_id: 'dQw4w9WgXcQ',
      title: 'Never gonna give you up',
      duration_pref: '30s',
      clip_count: 1,
      analyzed_at: '2026-01-01T10:00:00.000Z',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg',
      source_type: 'youtube',
      clip_titles: ['Clip A'],
      key_quotes: ['q1'],
      summary: 'A summary #tag',
    });
  });

  it('maps uploaded videos to local URLs and frame thumbnails', () => {
    seed(
      {
        video_id: 'upload_deadbeef_clip',
        video_url: '/api/video/upload_deadbeef_clip.mp4',
        source_type: 'upload',
      },
      '15s_1_5',
    );

    const [entry] = readHistoryEntries();

    expect(entry.duration_pref).toBe('15s');
    expect(entry.range_suffix).toBe('_1_5');
    expect(entry.source_type).toBe('upload');
    expect(entry.url).toBe('/api/video/upload_deadbeef_clip.mp4');
    expect(entry.thumbnail).toBe('/api/frame/upload_deadbeef_clip?t=2');
  });

  it('reconstructs Google Drive permalinks', () => {
    seed(
      {
        video_id: 'gdrive_abcDEF1234567890xyz',
        source_type: 'gdrive',
      },
      '60s',
    );

    const [entry] = readHistoryEntries();

    expect(entry.source_type).toBe('gdrive');
    expect(entry.url).toBe('https://drive.google.com/file/d/abcDEF1234567890xyz/view');
    expect(entry.thumbnail).toContain('/api/frame/');
  });

  it('ignores unrelated, malformed and incomplete cache entries', () => {
    localStorage.setItem('unrelated_key', 'value');
    localStorage.setItem('cheat_clip_cache_broken_30s', '{not json}');
    localStorage.setItem('cheat_clip_cache_novideo_30s', JSON.stringify({ title: 'x' }));

    expect(readHistoryEntries()).toEqual([]);
  });

  it('sorts entries newest first and falls back to now without a timestamp', () => {
    seed({ video_id: 'oldVideo1' }, '30s', '2020-01-01T00:00:00.000Z');
    seed({ video_id: 'newVideo2' }, '30s', '2026-01-01T00:00:00.000Z');
    seed({ video_id: 'noTimestamp' }, '30s');

    const entries = readHistoryEntries();

    expect(entries.map((entry) => entry.video_id)).toEqual([
      'noTimestamp',
      'newVideo2',
      'oldVideo1',
    ]);
  });

  it('returns an empty list when storage cannot be read', () => {
    const brokenStorage = {
      get length(): number {
        throw new Error('blocked');
      },
      key: () => null,
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
      clear: () => undefined,
    } as unknown as Storage;

    expect(readHistoryEntries(brokenStorage)).toEqual([]);
  });
});
