import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicLandingSliceView } from './public-landing-slice';

describe('public landing slice component', () => {
  test('renders first minimal public-facing slice', () => {
    const html = renderToStaticMarkup(<PublicLandingSliceView locale="en" state="empty" />);

    assert.match(html, /AI Sandbox/);
    assert.match(html, /Build software by chatting with AI in isolated sandboxes\./);
    assert.match(html, /Core Product Surface/);
    assert.match(html, /Isolated Sessions/);
    assert.match(html, /Deterministic Behavior/);
    assert.match(html, /AI-Assisted Workflow/);
  });

  test('renders state messaging for loading, error, and ready', () => {
    const loadingHtml = renderToStaticMarkup(<PublicLandingSliceView locale="en" state="loading" />);
    const errorHtml = renderToStaticMarkup(<PublicLandingSliceView locale="en" state="error" />);
    const readyHtml = renderToStaticMarkup(<PublicLandingSliceView locale="en" state="ready" />);

    assert.match(loadingHtml, /Loading public surface\.\.\./);
    assert.match(errorHtml, /Unable to initialize this public surface\./);
    assert.match(readyHtml, /Signed-in state detected\./);
  });

  test('keeps authenticated-app scope out of public slice', () => {
    const html = renderToStaticMarkup(<PublicLandingSliceView locale="en" state="empty" />);

    assert.ok(!html.includes('History / Control'));
    assert.ok(!html.includes('Dashboard'));
    assert.ok(!html.includes('Timeline'));
    assert.ok(!html.includes('Diff'));
    assert.ok(!html.includes('Revert'));
  });
});
