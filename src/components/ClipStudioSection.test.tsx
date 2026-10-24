import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ClipStudioSection } from './ClipStudioSection';
import { LanguageProvider } from '../locales';
import type { BatchRenderProgress, ViralClip } from '../types';

const clip: ViralClip = {
  title: 'Test clip',
  start_time: 10,
  end_time: 40,
  hook_time: 12,
  virality_score: 88,
  key_quotes: ['hello world'],
  transcript: 'hello world',
  title_suggestion: 'Test clip',
  caption_suggestion: '',
  hashtag_suggestion: '#test',
};

beforeAll(() => {
  // jsdom lacks a few browser APIs used by the preview/player.
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  class MockObserver {
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn(() => []);
  }
  vi.stubGlobal('ResizeObserver', MockObserver);
  vi.stubGlobal('IntersectionObserver', MockObserver);

  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
});

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/fonts')) {
        return new Response(JSON.stringify({ success: true, fonts: [] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/hardware-accel')) {
        return new Response(
          JSON.stringify({
            status: 'success',
            active_default: 'libx264',
            recommended: 'cpu',
            support: { nvenc: false, amf: false, qsv: false, cpu: true, recommended: 'cpu' },
            options: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }),
  );
});

describe('ClipStudioSection', () => {
  it('mounts and renders the studio controls with marked clips', () => {
    render(
      <LanguageProvider>
        <ClipStudioSection
          videoUrl=""
          videoId="test-video"
          allClips={[clip]}
          markedClips={[clip]}
          activeClip={clip}
          onStartRender={vi.fn()}
          isRendering={false}
        />
      </LanguageProvider>,
    );

    // Header + render panel are always visible once the studio mounts.
    expect(screen.getByText(/cheat clip auto clipper/i)).toBeTruthy();
    expect(screen.getByText(/live framing preview/i)).toBeTruthy();
    expect(screen.getByText(/batch render checklist/i)).toBeTruthy();
  });

  it('renders without marked clips (empty selection state)', () => {
    render(
      <LanguageProvider>
        <ClipStudioSection
          videoUrl=""
          videoId="test-video"
          allClips={[clip]}
          markedClips={[]}
          activeClip={clip}
          onStartRender={vi.fn()}
          isRendering={false}
        />
      </LanguageProvider>,
    );

    expect(document.body.textContent).toMatch(/no clips selected/i);
  });

  it('renders the batch queue and renders the primary CTA', () => {
    const batchProgress: BatchRenderProgress = {
      batch_id: 'batch_test',
      total_clips: 2,
      current_clip_index: 1,
      overall_status: 'completed',
      clips: [
        {
          clip_index: 0,
          title: 'First clip',
          status: 'completed',
          progress_percent: 100,
          download_url: '/api/download-rendered/first.mp4',
        },
        {
          clip_index: 1,
          title: 'Second clip',
          status: 'error',
          progress_percent: 40,
          error: 'moov atom not found',
        },
      ],
    };

    render(
      <LanguageProvider>
        <ClipStudioSection
          videoUrl=""
          videoId="test-video"
          allClips={[clip]}
          markedClips={[clip]}
          activeClip={clip}
          onStartRender={vi.fn()}
          isRendering={false}
          batchProgress={batchProgress}
          onRetryClip={vi.fn()}
          onDismissProgress={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(screen.getByText(/batch render queue/i)).toBeTruthy();
    expect(screen.getByText(/batch render 1 clip/i)).toBeTruthy();
    // The failed clip surfaces the friendly error box with a retry button.
    expect(screen.getByText(/download interrupted/i)).toBeTruthy();
  });
});
