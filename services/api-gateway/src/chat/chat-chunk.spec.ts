import { CHAT_CHUNK_MAX_CHARS, CHAT_CHUNK_MAX_PARTS, chunkChatText } from './chat-chunk';

const CUT = 'Cut here: read the rest on the Results page.';

function codePoints(text: string): number {
  return Array.from(text).length;
}

describe('chunkChatText (CHAT-DISCORD-01 C1)', () => {
  it('keeps a short answer as one part', () => {
    expect(chunkChatText('  Hello there.  ', CUT)).toEqual({ parts: ['Hello there.'], cut: false });
    expect(chunkChatText('   ', CUT)).toEqual({ parts: [], cut: false });
  });

  it('uses 1900 characters and 5 parts by default (Discord allows 2000)', () => {
    expect(CHAT_CHUNK_MAX_CHARS).toBe(1900);
    expect(CHAT_CHUNK_MAX_PARTS).toBe(5);
  });

  it('splits at paragraph breaks first, then line breaks, then spaces', () => {
    const paragraph = 'a'.repeat(1200);
    const text = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    const { parts, cut } = chunkChatText(text, CUT);
    expect(cut).toBe(false);
    expect(parts).toEqual([paragraph, paragraph, paragraph]);

    const lines = Array.from({ length: 40 }, (_, i) => `line ${i} ${'x'.repeat(90)}`).join('\n');
    const byLine = chunkChatText(lines, CUT);
    for (const part of byLine.parts) {
      expect(codePoints(part)).toBeLessThanOrEqual(1900);
      expect(part.startsWith('line ')).toBe(true);
      expect(part.endsWith('x')).toBe(true);
    }
    expect(byLine.parts.join('\n')).toBe(lines);

    const words = Array.from({ length: 1000 }, () => 'word').join(' ');
    const byWord = chunkChatText(words, CUT);
    expect(byWord.parts.every((part) => !part.startsWith(' ') && !part.endsWith(' '))).toBe(true);
    expect(byWord.parts.join(' ')).toBe(words);
  });

  it('cuts hard inside a long run of text without breaks', () => {
    const text = 'z'.repeat(4000);
    const { parts } = chunkChatText(text, CUT);
    expect(parts.map(codePoints)).toEqual([1900, 1900, 200]);
    expect(parts.join('')).toBe(text);
  });

  it('never more than 5 parts of 1900: the fifth ends with the cut notice', () => {
    const text = Array.from({ length: 300 }, (_, i) => `Paragraph ${i}. ${'text '.repeat(40)}`).join('\n\n');
    expect(codePoints(text)).toBeGreaterThan(5 * 1900);
    const { parts, cut } = chunkChatText(text, CUT);
    expect(cut).toBe(true);
    expect(parts).toHaveLength(5);
    for (const part of parts) {
      expect(codePoints(part)).toBeLessThanOrEqual(1900);
    }
    expect(parts[4].endsWith(`\n\n${CUT}`)).toBe(true);
    expect(parts.slice(0, 4).some((part) => part.includes(CUT))).toBe(false);
  });

  it('counts code points, so emoji and CJK never break the limit', () => {
    const text = '答'.repeat(5000) + '🙂'.repeat(5000);
    const { parts, cut } = chunkChatText(text, '截斷');
    expect(cut).toBe(true);
    expect(parts).toHaveLength(5);
    for (const part of parts) {
      expect(codePoints(part)).toBeLessThanOrEqual(1900);
      expect(part).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
    }
  });

  it('honours smaller limits and refuses a notice that cannot fit', () => {
    const { parts, cut } = chunkChatText('a b c d e f g h i j k l m n o p', 'cut', { maxChars: 10, maxParts: 2 });
    expect(cut).toBe(true);
    expect(parts.every((part) => codePoints(part) <= 10)).toBe(true);
    expect(parts[1].endsWith('\n\ncut')).toBe(true);
    expect(() => chunkChatText('text', 'x'.repeat(20), { maxChars: 10 })).toThrow('cut notice');
  });
});
