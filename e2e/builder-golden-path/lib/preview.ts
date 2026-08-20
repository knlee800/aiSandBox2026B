import type { Page } from '@playwright/test';
import {
  PREVIEW_HEADING,
  PREVIEW_PARAGRAPH,
  PREVIEW_TIMEOUT_MS,
  SELECTORS,
} from './constants';

export class PreviewAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PreviewAssertionError';
  }
}

export interface PreviewCheckResult {
  preview: 'PASS';
  heading: string;
  paragraph: string;
}

export function assertPreviewHtml(
  html: string,
  expected: { heading?: string; paragraph?: string } = {},
): void {
  const heading = expected.heading ?? PREVIEW_HEADING;
  const paragraph = expected.paragraph ?? PREVIEW_PARAGRAPH;
  if (!html.includes(heading)) {
    throw new PreviewAssertionError(`Preview HTML missing heading ${JSON.stringify(heading)}.`);
  }
  if (!html.includes(paragraph)) {
    throw new PreviewAssertionError(
      `Preview HTML missing paragraph ${JSON.stringify(paragraph)}.`,
    );
  }
}

export async function startAndAssertPreview(
  page: Page,
  options?: { timeoutMs?: number; heading?: string; paragraph?: string },
): Promise<PreviewCheckResult> {
  const timeoutMs = options?.timeoutMs ?? PREVIEW_TIMEOUT_MS;
  const heading = options?.heading ?? PREVIEW_HEADING;
  const paragraph = options?.paragraph ?? PREVIEW_PARAGRAPH;

  await page.locator(SELECTORS.previewStart).click();
  const iframe = page.frameLocator(SELECTORS.previewIframe);
  await iframe.locator('h1').waitFor({ timeout: timeoutMs });
  const headingText = (await iframe.locator('h1').innerText()).trim();
  const paragraphText = (await iframe.locator('p').first().innerText()).trim();

  if (headingText !== heading) {
    await page.screenshot({ path: 'preview-heading-mismatch.png', fullPage: true }).catch(() => undefined);
    throw new PreviewAssertionError(
      `Preview heading mismatch: expected ${JSON.stringify(heading)}, received ${JSON.stringify(headingText)}.`,
    );
  }
  if (paragraphText !== paragraph) {
    await page.screenshot({ path: 'preview-paragraph-mismatch.png', fullPage: true }).catch(() => undefined);
    throw new PreviewAssertionError(
      `Preview paragraph mismatch: expected ${JSON.stringify(paragraph)}, received ${JSON.stringify(paragraphText)}.`,
    );
  }

  return { preview: 'PASS', heading: headingText, paragraph: paragraphText };
}

export async function assertPreviewFromPageContent(
  page: Page,
  expected?: { heading?: string; paragraph?: string },
): Promise<PreviewCheckResult> {
  const html = await page.content();
  assertPreviewHtml(html, expected);
  return {
    preview: 'PASS',
    heading: expected?.heading ?? PREVIEW_HEADING,
    paragraph: expected?.paragraph ?? PREVIEW_PARAGRAPH,
  };
}
