/**
 * Optional server access key handling.
 *
 * When the backend runs with ADMIN_API_KEY (or CHEAT_CLIP_API_KEY), every
 * state-changing /api request must send that key through the X-API-Key header.
 * The key is stored in localStorage and injected by a small fetch wrapper so
 * existing call sites do not need to change.
 */

const STORAGE_KEY = 'cheat_clip_server_api_key';

declare global {
  interface Window {
    __cheatClipKeyFetchInstalled?: boolean;
  }
}

export function getServerApiKey(): string {
  try {
    return (localStorage.getItem(STORAGE_KEY) || '').trim();
  } catch {
    return '';
  }
}

export function setServerApiKey(value: string): void {
  try {
    const clean = value.trim();
    if (clean) {
      localStorage.setItem(STORAGE_KEY, clean);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode); the key simply won't persist.
  }
}

function isApiRequest(input: RequestInfo | URL): boolean {
  const url =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
  try {
    if (url.startsWith('/api/')) return true;
    const parsed = new URL(url, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/** Install the X-API-Key fetch interceptor exactly once. */
export function installServerApiKeyFetch(): void {
  if (typeof window === 'undefined' || window.__cheatClipKeyFetchInstalled) return;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const key = getServerApiKey();
    if (!key || !isApiRequest(input)) {
      return nativeFetch(input, init);
    }

    const baseHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    const headers = new Headers(baseHeaders);
    if (!headers.has('X-API-Key')) {
      headers.set('X-API-Key', key);
    }
    return nativeFetch(input, { ...init, headers });
  };

  window.__cheatClipKeyFetchInstalled = true;
}
