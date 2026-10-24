import type { FontSizeOption, TextCaseOption } from '../../types';

export function applyLetterCase(text: string, style: TextCaseOption): string {
  if (style === 'uppercase') return text.toUpperCase();
  if (style === 'lowercase') return text.toLowerCase();
  return text.toLowerCase().replace(/(?:^|\s|\b)\w/g, (c) => c.toUpperCase());
}

/**
 * Intelligently wrap a title across 1-4 balanced lines.
 * Mirrors backend `video_engine.wrap_title_smart`.
 */
export function formatTitleSmart(
  rawText: string,
  style: TextCaseOption,
  sizePreset: FontSizeOption,
): { formatted: string; lineCount: number } {
  const raw = rawText.trim();
  if (!raw) return { formatted: '', lineCount: 1 };

  const cased = applyLetterCase(raw, style);

  // Preserve manual line breaks if the user typed them.
  if (cased.includes('\n')) {
    const manualLines = cased
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return {
      formatted: manualLines.join('\n'),
      lineCount: Math.max(1, manualLines.length),
    };
  }

  const words = cased.split(/\s+/).filter(Boolean);
  const maxSingleLen = sizePreset === 'small' ? 24 : sizePreset === 'big' ? 13 : 19;
  if (words.length <= 1 || cased.length <= maxSingleLen) {
    return { formatted: cased, lineCount: 1 };
  }

  const totalLen = cased.length;
  const targetLines = Math.min(4, Math.max(2, Math.ceil(totalLen / maxSingleLen)));
  const targetPerLine = totalLen / targetLines;

  const lines: string[] = [];
  let currentLine: string[] = [];
  let currentLen = 0;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const remainingWords = words.length - i;
    const remainingLines = targetLines - lines.length;

    if (
      remainingLines > 1 &&
      currentLine.length > 0 &&
      (currentLen + word.length > targetPerLine * 1.15 || remainingWords <= remainingLines - 1)
    ) {
      lines.push(currentLine.join(' '));
      currentLine = [word];
      currentLen = word.length;
    } else {
      currentLine.push(word);
      currentLen += word.length + 1;
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }

  return { formatted: lines.join('\n'), lineCount: Math.max(1, lines.length) };
}
