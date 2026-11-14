/**
 * CHAT-DISCORD-01 slice C1 (stage-start section 6.3): a result cut into chat
 * messages.
 *
 * - Parts of at most 1900 characters (Discord's limit is 2000), counted as
 *   code points like the transport counts them.
 * - Split at a paragraph break, else a line break, else a space, else hard.
 * - At most 5 parts. A longer text ends with the cut notice on the fifth
 *   part ("cut: read the rest on the Results page"), which still keeps the
 *   1900-character limit.
 * - Plain text only; the transport sends every message with mentions off.
 */

export const CHAT_CHUNK_MAX_CHARS = 1900;
export const CHAT_CHUNK_MAX_PARTS = 5;

export interface ChatChunks {
  parts: string[];
  /** True when the text did not fit in the parts and the cut notice was added. */
  cut: boolean;
}

function length(text: string): number {
  return Array.from(text).length;
}

/** The best split point in the first `max` code points of `chars`: an index into `chars`. */
function splitPoint(chars: readonly string[], max: number): number {
  if (chars.length <= max) {
    return chars.length;
  }
  const head = chars.slice(0, max + 1).join('');
  // Prefer the last break that leaves at least half a part, so tiny parts are rare.
  const minimum = Math.floor(max / 2);
  for (const pattern of [/\n\s*\n/g, /\n/g, /\s/g]) {
    let best = -1;
    let match: RegExpExecArray | null;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(head)) !== null) {
      const at = length(head.slice(0, match.index));
      if (at <= max && at >= minimum) {
        best = at;
      }
      if (match[0].length === 0) {
        pattern.lastIndex += 1;
      }
    }
    if (best > 0) {
      return best;
    }
  }
  return max;
}

/** Cuts `text` into at most `maxParts` parts of at most `maxChars` code points each. */
export function chunkChatText(
  text: string,
  cutNotice: string,
  options: { maxChars?: number; maxParts?: number } = {},
): ChatChunks {
  const maxChars = options.maxChars ?? CHAT_CHUNK_MAX_CHARS;
  const maxParts = options.maxParts ?? CHAT_CHUNK_MAX_PARTS;
  const notice = `\n\n${cutNotice}`;
  const noticeLength = length(notice);
  if (noticeLength >= maxChars) {
    throw new Error('cut notice does not fit in a part');
  }

  let rest = Array.from(text.trim());
  const parts: string[] = [];
  let cut = false;
  while (rest.length > 0 && parts.length < maxParts) {
    const last = parts.length === maxParts - 1;
    if (last && rest.length > maxChars) {
      const at = splitPoint(rest, maxChars - noticeLength);
      parts.push(`${rest.slice(0, at).join('').trimEnd()}${notice}`);
      cut = true;
      rest = [];
      break;
    }
    const at = splitPoint(rest, maxChars);
    const part = rest.slice(0, at).join('').trimEnd();
    rest = Array.from(rest.slice(at).join('').replace(/^\s+/, ''));
    if (part.length > 0) {
      parts.push(part);
    }
  }
  return { parts, cut };
}
