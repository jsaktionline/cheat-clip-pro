import { useEffect, useRef, useState } from 'react';
import { resilientFetch } from '../utils/api';
import type { OpenRouterModel } from '../types';

interface UseAiModelsOptions {
  apiKey: string;
  openRouterKey: string;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export interface AiModelsState {
  availableModels: string[];
  loadingModels: boolean;
  openRouterModels: OpenRouterModel[];
  loadingOpenRouterModels: boolean;
}

/**
 * Fetches the model catalogue for the configured AI provider.
 *
 * The provider API keys travel through request headers (never query strings)
 * and the selected model is read through a ref so the effects do not re-run on
 * every keystroke/selection.
 */
export function useAiModels({
  apiKey,
  openRouterKey,
  selectedModel,
  onSelectModel,
}: UseAiModelsOptions): AiModelsState {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [openRouterModels, setOpenRouterModels] = useState<OpenRouterModel[]>([]);
  const [loadingOpenRouterModels, setLoadingOpenRouterModels] = useState(false);

  const selectedModelRef = useRef(selectedModel);
  const onSelectModelRef = useRef(onSelectModel);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
    onSelectModelRef.current = onSelectModel;
  }, [selectedModel, onSelectModel]);

  // Gemini models: debounced so typing a key does not spam the API.
  useEffect(() => {
    const cleanKey = apiKey.trim();
    if (!cleanKey || cleanKey.length < 20 || cleanKey.toLowerCase() === 'mock') {
      setAvailableModels([]);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setLoadingModels(true);
      try {
        const res = await resilientFetch('/api/models', {
          headers: { 'X-Gemini-Api-Key': cleanKey },
          maxRetries: 3,
          retryDelay: 800,
          silent: true,
        });
        if (cancelled || !res.ok) return;

        const data = await res.json();
        const models: string[] = Array.isArray(data?.models) ? data.models : [];
        if (cancelled || models.length === 0) return;

        setAvailableModels(models);
        const current = selectedModelRef.current;
        if (!models.includes(current) || current.includes('1.5') || current.includes('1.0')) {
          const fallback = models.find((m) => m.includes('flash')) || models[0] || 'gemini-2.5-flash';
          onSelectModelRef.current(fallback);
        }
      } catch (err) {
        console.error('Failed to retrieve available Gemini models:', err);
      } finally {
        if (!cancelled) setLoadingModels(false);
      }
    }, 600);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [apiKey]);

  // OpenRouter publishes its catalogue without a key, so always ask once.
  useEffect(() => {
    let cancelled = false;
    const cleanKey = openRouterKey.trim();

    const fetchOpenRouterModels = async () => {
      if (!cancelled) setLoadingOpenRouterModels(true);
      try {
        const res = await resilientFetch('/api/openrouter-models', {
          headers: cleanKey ? { 'X-OpenRouter-Api-Key': cleanKey } : undefined,
          maxRetries: 2,
          retryDelay: 800,
          silent: true,
        });
        if (!res.ok || cancelled) return;

        const data = await res.json();
        if (!cancelled && Array.isArray(data?.models) && data.models.length > 0) {
          setOpenRouterModels(data.models);
        }
      } catch (err) {
        console.error('Failed to retrieve OpenRouter models:', err);
      } finally {
        if (!cancelled) setLoadingOpenRouterModels(false);
      }
    };

    void fetchOpenRouterModels();
    return () => {
      cancelled = true;
    };
  }, [openRouterKey]);

  return {
    availableModels,
    loadingModels,
    openRouterModels,
    loadingOpenRouterModels,
  };
}
