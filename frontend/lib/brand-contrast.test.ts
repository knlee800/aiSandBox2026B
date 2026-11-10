import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) =>
    v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

function contrastAgainst(hex: string, bg: string): number {
  const a = luminance(hex);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function contrastWithWhite(hex: string): number {
  return contrastAgainst(hex, '#ffffff');
}

function brandValues(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--color-(brand(?:-hover|-text)?):\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
  return out;
}

const darkStart = css.indexOf('prefers-color-scheme: dark');
const light = brandValues(css.slice(0, darkStart));
const dark = brandValues(css.slice(darkStart));

describe('brand contrast (WCAG AA, white text)', () => {
  for (const [mode, vals] of [['light', light], ['dark', dark]] as const) {
    for (const name of ['brand', 'brand-hover']) {
      it(`${mode} ${name} is at least 4.5:1 against white`, () => {
        assert.ok(vals[name], `${mode} ${name} found in globals.css`);
        const ratio = contrastWithWhite(vals[name]);
        assert.ok(ratio >= 4.5, `${mode} ${name} ${vals[name]} is ${ratio.toFixed(2)}:1`);
      });
    }
  }
  it('dark hover differs from dark brand', () => {
    assert.notEqual(dark.brand, dark['brand-hover']);
  });
  it('brand-text is at least 4.5:1 on the light and dark page backgrounds', () => {
    assert.ok(light['brand-text'] && dark['brand-text'], 'brand-text defined in both modes');
    assert.ok(contrastAgainst(light['brand-text'], '#ffffff') >= 4.5);
    assert.ok(contrastAgainst(dark['brand-text'], '#0a0a0a') >= 4.5);
  });
  it('tailwind config exposes the brand-text utility', () => {
    const cfg = readFileSync(join(__dirname, '..', 'tailwind.config.js'), 'utf8');
    assert.match(cfg, /text:\s*'var\(--color-brand-text\)'/);
  });
  it('no text-brand link class is left on the auth pages or landing slice', () => {
    const files = [
      'app/[locale]/login/page.tsx',
      'app/[locale]/register/page.tsx',
      'app/[locale]/forgot-password/page.tsx',
      'app/[locale]/reset-password/page.tsx',
      'components/public/public-landing-slice.tsx',
    ];
    for (const f of files) {
      const src = readFileSync(join(__dirname, '..', f), 'utf8');
      assert.doesNotMatch(src, /text-brand(?![-\w])/, f);
    }
  });
});
