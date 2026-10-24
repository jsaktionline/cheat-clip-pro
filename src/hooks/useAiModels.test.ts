import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

import { useAiModels } from './useAiModels';
import { resilientFetch } from '../utils/api';

vi.mock('../utils/api', () => ({
  resilientFetch: vi.fn(),
}));

const mockedFetch = vi.mocked(resilientFetch);

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('useAiModels', () => {
  it('fetches Gemini models with a header key and selects a flash fallback', async () => {
    mockedFetch.mockImplementation(async () =>
      jsonResponse({ models: ['gemini-2.5-pro', 'gemini-2.5-flash'] }),
    );
    const onSelectModel = vi.fn();

    const { result } = renderHook(() =>
      useAiModels({
        apiKey: 'AIza'.padEnd(30, 'x'),
        openRouterKey: '',
        selectedModel: 'legacy-1.0-model',
        onSelectModel,
      }),
    );

    await waitFor(
      () => expect(result.current.availableModels).toHaveLength(2),
      { timeout: 3000 },
    );

    expect(mockedFetch).toHaveBeenCalledWith(
      '/api/models',
      expect.objectContaining({
        headers: { 'X-Gemini-Api-Key': 'AIza'.padEnd(30, 'x') },
      }),
    );
    expect(result.current.loadingModels).toBe(false);
    expect(onSelectModel).toHaveBeenCalledWith('gemini-2.5-flash');
  });

  it('does not call the API for an empty or mock key', async () => {
    mockedFetch.mockImplementation(async () => jsonResponse({ models: [] }));

    renderHook(() =>
      useAiModels({
        apiKey: '',
        openRouterKey: '',
        selectedModel: 'gemini-2.5-flash',
        onSelectModel: vi.fn(),
      }),
    );

    // Only the OpenRouter catalogue request is expected (it is public).
    await waitFor(() => expect(mockedFetch).toHaveBeenCalledTimes(1));
    expect(mockedFetch.mock.calls[0][0]).toBe('/api/openrouter-models');
  });

  it('sends the OpenRouter key through a header and exposes the catalogue', async () => {
    mockedFetch.mockImplementation(async (input) => {
      if (input === '/api/openrouter-models') {
        return jsonResponse({
          models: [{ id: 'google/gemini-2.5-flash', name: 'Gemini 2.5 Flash' }],
        });
      }
      return jsonResponse({ models: [] });
    });

    const { result } = renderHook(() =>
      useAiModels({
        apiKey: '',
        openRouterKey: 'sk-or-v1-test',
        selectedModel: 'gemini-2.5-flash',
        onSelectModel: vi.fn(),
      }),
    );

    await waitFor(() => expect(result.current.openRouterModels).toHaveLength(1));

    const openRouterCall = mockedFetch.mock.calls.find(
      ([url]) => url === '/api/openrouter-models',
    );
    expect(openRouterCall?.[1]).toMatchObject({
      headers: { 'X-OpenRouter-Api-Key': 'sk-or-v1-test' },
    });
    expect(result.current.loadingOpenRouterModels).toBe(false);
  });
});
