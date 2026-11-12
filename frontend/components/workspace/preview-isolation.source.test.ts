import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

/**
 * PREVIEW-ORIGIN-01 source checks: the preview iframe is sandboxed without
 * top-window navigation, the Select Element toggle is hidden (its code and
 * keys stay), and /driver keeps its API key in memory only.
 */

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('PREVIEW-ORIGIN-01 workspace preview iframe', () => {
  const shell = read('./workspace-shell.tsx');

  test('the only iframe carries the shared sandbox constant', () => {
    const iframes = shell.match(/<iframe[\s\S]*?\/>/g) ?? [];
    assert.equal(iframes.length, 1);
    assert.match(iframes[0], /sandbox=\{PREVIEW_IFRAME_SANDBOX\}/);
    assert.match(iframes[0], /data-testid="workspace-preview-iframe"/);
  });

  test('the sandbox list is exact and never allows top navigation or escaping the sandbox', () => {
    assert.match(
      shell,
      /export const PREVIEW_IFRAME_SANDBOX =\s+'allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads';/,
    );
    const code = withoutComments(shell);
    assert.doesNotMatch(code, /allow-top-navigation/);
    assert.doesNotMatch(code, /allow-popups-to-escape-sandbox/);
  });

  test('the picker toggle is behind a false flag and the picker code stays', () => {
    assert.match(shell, /export const PREVIEW_PICKER_TOGGLE_VISIBLE = false;/);
    assert.match(
      shell,
      /\{PREVIEW_PICKER_TOGGLE_VISIBLE \? \(\s*<button\s+type="button"\s+data-testid="workspace-preview-picker-toggle"/,
    );
    assert.match(shell, /const injectPickerScript = React\.useCallback\(/);
    assert.match(shell, /const removePickerScript = React\.useCallback\(/);
    assert.match(shell, /const handlePickerToggle = React\.useCallback\(/);
  });
});

describe('PREVIEW-ORIGIN-01 /driver API key', () => {
  const driver = read('../../app/[locale]/driver/page.tsx');
  const code = withoutComments(driver);

  test('never writes the API key to browser storage', () => {
    assert.doesNotMatch(code, /localStorage\.setItem\(\s*['"]driver_api_key['"]/);
    assert.doesNotMatch(code, /setItem\(\s*DRIVER_LEGACY_API_KEY_STORAGE_KEY/);
    assert.doesNotMatch(code, /sessionStorage/);
    assert.doesNotMatch(code, /setItem\([^)]*apiKey/);
  });

  test('never reads the API key from browser storage', () => {
    assert.doesNotMatch(code, /getItem\(\s*['"]driver_api_key['"]/);
    assert.doesNotMatch(code, /getItem\(\s*DRIVER_LEGACY_API_KEY_STORAGE_KEY/);
    assert.doesNotMatch(code, /setApiKey\(\s*saved/);
  });

  test('removes a previously stored key on load', () => {
    assert.match(code, /const DRIVER_LEGACY_API_KEY_STORAGE_KEY = 'driver_api_key';/);
    assert.match(code, /localStorage\.removeItem\(DRIVER_LEGACY_API_KEY_STORAGE_KEY\)/);
    // Inside a mount effect, guarded so blocked storage cannot break the page.
    assert.match(
      code,
      /useEffect\(\(\) => \{\s*try \{\s*localStorage\.removeItem\(DRIVER_LEGACY_API_KEY_STORAGE_KEY\);\s*\} catch \{/,
    );
  });

  test('the key still reaches the request only as a Bearer header', () => {
    assert.match(code, /Authorization: `Bearer \$\{apiKey\.trim\(\)\}`/);
  });
});
