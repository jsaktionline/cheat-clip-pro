import type { AnalyzeResponse } from '../types';

export interface HistoryEntry {
  video_id: string;
  title: string;
  duration_pref: string;
  clip_count: number;
  analyzed_at: string;
  thumbnail: string;
  url: string;
  source_type?: 'youtube' | 'upload' | 'gdrive';
  video_url?: string;
  range_suffix?: string;
  summary?: string;
  clip_titles?: string[];
  key_quotes?: string[];
}

const CACHE_PREFIX = 'cheat_clip_cache_';
const TIMESTAMP_PREFIX = 'cheat_clip_ts_';

/** Build the thumbnail/permalink pair for a cached analysis. */
function describeSource(data: AnalyzeResponse, videoId: string) {
  const isGDrive = data.source_type === 'gdrive' || videoId.startsWith('gdrive_');
  const isUpload = data.source_type === 'upload' || videoId.startsWith('upload_');

  let url = `https://www.youtube.com/watch?v=${videoId}`;
  if (isGDrive) {
    const match = videoId.match(/gdrive_([a-zA-Z0-9_-]+)/);
    const gdriveId = match ? match[1] : '';
    url = gdriveId ? `https://drive.google.com/file/d/${gdriveId}/view` : (data.video_url || '');
  } else if (isUpload) {
    url = data.video_url || `/api/video/${videoId}`;
  }

  const thumbnail = isGDrive || isUpload
    ? `/api/frame/${encodeURIComponent(videoId)}?t=2`
    : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;

  return {
    url,
    thumbnail,
    sourceType: (isGDrive ? 'gdrive' : isUpload ? 'upload' : 'youtube') as HistoryEntry['source_type'],
  };
}

/**
 * Read previously analysed videos from the browser cache.
 *
 * Every cached analysis is stored under
 * `cheat_clip_cache_<video_id>_<duration><rangeSuffix>`; the timestamp lives in
 * a sibling key. Malformed/incompatible entries are skipped instead of
 * breaking the whole history panel.
 */
export function readHistoryEntries(storage: Storage = localStorage): HistoryEntry[] {
  const entries: HistoryEntry[] = [];

  let keys: string[];
  try {
    keys = Array.from({ length: storage.length }, (_, i) => storage.key(i) || '');
  } catch {
    return entries;
  }

  for (const key of keys) {
    if (!key.startsWith(CACHE_PREFIX)) continue;

    try {
      const raw = storage.getItem(key);
      if (!raw) continue;

      const data = JSON.parse(raw) as AnalyzeResponse;
      if (!data || !data.video_id) continue;

      const videoId = data.video_id;
      const rest = key.substring(CACHE_PREFIX.length);
      const suffix = rest.substring(videoId.length + 1);
      const durationPref = suffix.split('_')[0];
      const rangeSuffix = suffix.substring(durationPref.length);

      const analyzedAt =
        storage.getItem(`${TIMESTAMP_PREFIX}${videoId}_${durationPref}${rangeSuffix}`) ||
        new Date().toISOString();

      const clips = data.clips || [];
      const clipTitles = clips.map((clip) => clip.title || '').filter(Boolean);
      const keyQuotes = clips.flatMap((clip) => clip.key_quotes || []).filter(Boolean);
      const { url, thumbnail, sourceType } = describeSource(data, videoId);

      entries.push({
        video_id: videoId,
        title: data.title,
        duration_pref: durationPref,
        clip_count: clips.length,
        analyzed_at: analyzedAt,
        thumbnail,
        url,
        source_type: sourceType,
        video_url: data.video_url,
        range_suffix: rangeSuffix,
        summary: data.summary || '',
        clip_titles: clipTitles,
        key_quotes: keyQuotes,
      });
    } catch {
      // Skip malformed entries.
    }
  }

  entries.sort((a, b) => {
    const left = new Date(a.analyzed_at).getTime();
    const right = new Date(b.analyzed_at).getTime();
    return (Number.isNaN(right) ? 0 : right) - (Number.isNaN(left) ? 0 : left);
  });

  return entries;
}
