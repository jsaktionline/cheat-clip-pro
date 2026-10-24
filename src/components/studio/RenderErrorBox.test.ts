import { describe, expect, it } from 'vitest';

import { getFriendlyErrorMessage } from './RenderErrorBox';

describe('getFriendlyErrorMessage', () => {
  it('explains interrupted downloads', () => {
    expect(getFriendlyErrorMessage('ffmpeg: moov atom not found')).toContain(
      'Download interrupted',
    );
  });

  it('maps YouTube bot verification errors to the cookies tip', () => {
    expect(getFriendlyErrorMessage("Sign in to confirm you're not a bot")).toContain(
      'Cookies Manager',
    );
  });

  it('distinguishes render timeouts from download timeouts', () => {
    expect(getFriendlyErrorMessage('Rendering timed out after 600s')).toContain(
      'Video rendering timed out',
    );
    expect(getFriendlyErrorMessage('Read timed out')).toContain(
      'Video download timed out',
    );
  });

  it('suggests the CPU encoder when the GPU encoder fails', () => {
    expect(getFriendlyErrorMessage('h264_nvenc failed')).toContain('Universal CPU');
  });

  it('reports disk-space problems', () => {
    expect(getFriendlyErrorMessage('OSError: No space left on device')).toContain(
      'Disk storage is full',
    );
  });

  it('reports transcription failures', () => {
    expect(getFriendlyErrorMessage('whisper model crashed')).toContain(
      'Word transcription failed',
    );
  });

  it('falls back to a generic FFmpeg message', () => {
    expect(getFriendlyErrorMessage('filter_complex: invalid argument')).toContain(
      'FFmpeg video rendering failed',
    );
  });

  it('passes short unknown errors through and truncates long ones', () => {
    expect(getFriendlyErrorMessage('weird failure')).toBe('weird failure');
    const long = 'x'.repeat(300);
    expect(getFriendlyErrorMessage(long)).toHaveLength(143);
    expect(getFriendlyErrorMessage(long).endsWith('...')).toBe(true);
  });

  it('handles empty input', () => {
    expect(getFriendlyErrorMessage('')).toBe('Rendering failed unexpectedly.');
  });
});
