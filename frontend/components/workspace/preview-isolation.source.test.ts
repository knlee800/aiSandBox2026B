import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from 'node:test';

/**
 * PREVIEW-ORIGIN-01 source checks: the preview iframe is sandboxed without
 * top-window navigation, and /driver keeps its API key in memory only.
 * (PREVIEW-PICKER-01 replaced the hidden-toggle check with the postMessage
 * checks below.)
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

});

/**
 * PREVIEW-PICKER-01 source checks: Select Element works over postMessage
 * with the preview origin from the status answer; nothing reaches into the
 * iframe's document and nothing posts to '*'.
 */
describe('PREVIEW-PICKER-01 picker over postMessage', () => {
  const shell = read('./workspace-shell.tsx');
  const logic = read('./workspace-preview.logic.ts');
  const page = read('../../app/[locale]/app/page.tsx');
  const shellCode = withoutComments(shell);
  const logicCode = withoutComments(logic);
  const pageCode = withoutComments(page);

  test('no code path reads iframe.contentDocument or injects a script into the preview', () => {
    for (const code of [shellCode, logicCode, pageCode]) {
      assert.doesNotMatch(code, /contentDocument/);
      assert.doesNotMatch(code, /generatePickerScriptSource|injectPickerScript|removePickerScript/);
    }
  });

  test("no postMessage uses '*' as its target", () => {
    for (const code of [shellCode, logicCode, pageCode]) {
      assert.doesNotMatch(code, /postMessage\([^;]*['"`]\*['"`]/);
    }
    const posts = shellCode.match(/\.postMessage\(/g) ?? [];
    assert.equal(posts.length, 1);
    assert.match(shellCode, /target\.postMessage\(buildPreviewBridgeCommand\(type\), targetOrigin\);/);
    assert.match(shellCode, /const targetOrigin = previewOriginRef\.current;\s+const target = previewIframeRef\.current\?\.contentWindow \?\? null;\s+if \(!targetOrigin \|\| !target\) \{\s+return;\s+\}/);
  });

  test('a message is checked against the preview origin and the iframe window before it is parsed', () => {
    assert.match(
      shellCode,
      /isValidVisualEditMessageOriginAndSource\(\{\s+expectedOrigin: previewOriginRef\.current,\s+messageOrigin: event\.origin,\s+expectedSource: previewIframeRef\.current\?\.contentWindow \?\? null,\s+messageSource: event\.source,\s+\}\)/,
    );
    assert.match(shellCode, /const message = parsePreviewBridgeMessage\(event\.data\);\s+if \(!message\) \{\s+return;\s+\}/);
    assert.doesNotMatch(shellCode, /expectedOrigin: (typeof )?window/);
  });

  test('the toggle is rendered only when the bridge is available, with its test id', () => {
    assert.doesNotMatch(shell, /PREVIEW_PICKER_TOGGLE_VISIBLE/);
    assert.match(
      shell,
      /\{props\.pickerAvailable \? \(\s*<button\s+type="button"\s+data-testid="workspace-preview-picker-toggle"/,
    );
    assert.match(shellCode, /const pickerAvailable = Boolean\(previewOrigin\) && pickerView\.bridgeReady;/);
    assert.equal((shellCode.match(/pickerAvailable=\{pickerAvailable\}/g) ?? []).length, 2);
  });

  test('the page keeps previewOrigin from the status answer and passes it to the shell', () => {
    assert.match(pageCode, /const \[previewOrigin, setPreviewOrigin\] = useState<string \| null>\(null\);/);
    assert.equal((pageCode.match(/rememberPreviewOrigin\(statusData\);/g) ?? []).length, 2);
    assert.match(pageCode, /previewOrigin=\{previewOrigin\}/);
    assert.match(pageCode, /const origin = readStatusPreviewOrigin\(status\);\s+if \(origin !== undefined\) \{\s+setPreviewOrigin\(origin\);\s+\}/);
  });

  test('the selection still feeds the existing Visual Edit prompt path', () => {
    assert.match(pageCode, /onPreviewElementSelected=\{handlePreviewElementSelected\}/);
    assert.match(pageCode, /function handlePreviewElementSelected\(element: SelectedPreviewElement \| null\): void \{\s+setSelectedPreviewElement\(element\);\s+\}/);
    assert.match(pageCode, /buildPromptWithSelectedPreviewElement\(/);
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
