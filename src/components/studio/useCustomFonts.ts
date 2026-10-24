import { useEffect, useRef, useState } from 'react';

import { resilientFetch } from '../../utils/api';
import type { FontItem } from '../../types';

const BUILTIN_FONTS: FontItem[] = [
  { name: 'Outfit', is_custom: false },
  { name: 'Montserrat', is_custom: false },
  { name: 'Inter', is_custom: false },
  { name: 'Impact', is_custom: false },
  { name: 'Bebas Neue', is_custom: false },
  { name: 'Anton', is_custom: false },
  { name: 'Poppins', is_custom: false },
  { name: 'Arial Black', is_custom: false },
];

interface UseCustomFontsOptions {
  onSelectTitleFont: (name: string) => void;
  onSelectCaptionFont: (name: string) => void;
}

/**
 * Custom font library: loads server-side fonts, registers FontFace objects for
 * the live preview and handles uploads from the title/subtitle dropzones.
 */
export function useCustomFonts({ onSelectTitleFont, onSelectCaptionFont }: UseCustomFontsOptions) {
  const [availableFonts, setAvailableFonts] = useState<FontItem[]>(BUILTIN_FONTS);
  const [isUploadingFont, setIsUploadingFont] = useState<boolean>(false);
  const [isTitleFontDragging, setIsTitleFontDragging] = useState<boolean>(false);
  const [isSubFontDragging, setIsSubFontDragging] = useState<boolean>(false);
  const titleFontInputRef = useRef<HTMLInputElement | null>(null);
  const subtitleFontInputRef = useRef<HTMLInputElement | null>(null);

  const loadCustomFontFace = (name: string, url: string) => {
    try {
      // Isolate custom font face names so they do not overwrite UI fonts
      // such as 'Inter' 400 that the app itself relies on.
      const isSystemUiFont = ['inter', 'outfit', 'jetbrains mono', 'roboto', 'segoe ui'].includes(
        name.trim().toLowerCase(),
      );
      const familyName = isSystemUiFont ? `Preview-${name}` : name;
      const font = new FontFace(familyName, `url(${url})`);
      font
        .load()
        .then((loaded) => {
          (document.fonts as Set<FontFace>).add(loaded);
        })
        .catch((err) => console.warn(`Font '${name}' load error:`, err));
    } catch (e) {
      console.warn('FontFace API error:', e);
    }
  };

  useEffect(() => {
    const fetchAvailableFonts = async () => {
      try {
        const res = await resilientFetch('/api/fonts', {
          maxRetries: 3,
          retryDelay: 1000,
          silent: true,
        });
        if (!res.ok) return;

        const data = await res.json();
        if (data.success && Array.isArray(data.fonts)) {
          setAvailableFonts(data.fonts);
          data.fonts.forEach((font: FontItem) => {
            if (font.url) loadCustomFontFace(font.name, font.url);
          });
        }
      } catch {
        // Fall back to the built-in font list.
      }
    };

    void fetchAvailableFonts();
    // loadCustomFontFace is a stable local helper.
  }, []);

  const handleUploadFont = async (file: File, target: 'title' | 'subtitle') => {
    if (!file) return;
    setIsUploadingFont(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await resilientFetch('/api/upload-font', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.font_name) {
        if (data.url) loadCustomFontFace(data.font_name, data.url);
        setAvailableFonts((prev) => {
          if (!prev.some((font) => font.name.toLowerCase() === data.font_name.toLowerCase())) {
            return [
              ...prev,
              {
                name: data.font_name,
                is_custom: true,
                filename: data.filename,
                url: data.url,
              },
            ];
          }
          return prev;
        });
        if (target === 'title') {
          onSelectTitleFont(data.font_name);
        } else {
          onSelectCaptionFont(data.font_name);
        }
      }
    } catch (err) {
      console.error('Failed to upload custom font:', err);
    } finally {
      setIsUploadingFont(false);
    }
  };

  return {
    availableFonts,
    isUploadingFont,
    isTitleFontDragging,
    setIsTitleFontDragging,
    isSubFontDragging,
    setIsSubFontDragging,
    titleFontInputRef,
    subtitleFontInputRef,
    handleUploadFont,
  };
}
