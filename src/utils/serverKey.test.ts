import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getServerApiKey,
  installServerApiKeyFetch,
  setServerApiKey,
} from './serverKey';

const nativeFetch = globalThis.fetch;

function mockFetch() {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const spy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input, init });
    return new Response('{}', { status: 200 });
  });
  window.fetch = spy as unknown as typeof window.fetch;
  delete window.__cheatClipKeyFetchInstalled;
  return { spy, calls };
}

afterEach(() => {
  window.fetch = nativeFetch;
  delete window.__cheatClipKeyFetchInstalled;
  localStorage.clear();
});

describe('server access key storage', () => {
  it('trims and persists the key', () => {
    setServerApiKey('  secret-key  ');
    expect(getServerApiKey()).toBe('secret-key');
  });

  it('removes the key when set to an empty value', () => {
    setServerApiKey('secret-key');
    setServerApiKey('   ');
    expect(getServerApiKey()).toBe('');
    expect(localStorage.getItem('cheat_clip_server_api_key')).toBeNull();
  });
});

describe('installServerApiKeyFetch', () => {
  it('injects X-API-Key for same-origin /api requests', async () => {
    setServerApiKey('secret-key');
    const { calls } = mockFetch();
    installServerApiKeyFetch();

    await window.fetch('/api/analyze', { method: 'POST' });

    const headers = new Headers(calls[0].init?.headers);
    expect(headers.get('X-API-Key')).toBe('secret-key');
  });

  it('injects the key for absolute same-origin URLs', async () => {
    setServerApiKey('secret-key');
    const { calls } = mockFetch();
    installServerApiKeyFetch();

    await window.fetch(`${window.location.origin}/api/render-batch`, { method: 'POST' });

    expect(new Headers(calls[0].init?.headers).get('X-API-Key')).toBe('secret-key');
  });

  it('leaves external requests untouched', async () => {
    setServerApiKey('secret-key');
    const { calls } = mockFetch();
    installServerApiKeyFetch();

    await window.fetch('https://www.youtube.com/watch?v=abc');

    expect(calls[0].init?.headers).toBeUndefined();
  });

  it('does not override an explicitly provided header', async () => {
    setServerApiKey('secret-key');
    const { calls } = mockFetch();
    installServerApiKeyFetch();

    await window.fetch('/api/analyze', {
      method: 'POST',
      headers: { 'X-API-Key': 'explicit' },
    });

    expect(new Headers(calls[0].init?.headers).get('X-API-Key')).toBe('explicit');
  });

  it('is a no-op when no key is configured', async () => {
    const { spy } = mockFetch();
    installServerApiKeyFetch();

    await window.fetch('/api/analyze', { method: 'POST' });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1]?.headers).toBeUndefined();
  });

  it('only installs once', () => {
    const { spy } = mockFetch();
    installServerApiKeyFetch();
    installServerApiKeyFetch();
    expect(window.__cheatClipKeyFetchInstalled).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});
