import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicLandingSliceView } from './public-landing-slice';

describe('public landing slice component', () => {
  const baseProps = {
    locale: 'en',
    prompt: '',
    onPromptChange: () => {},
    onPromptSubmit: () => {},
    strings: {
      appName: 'AI Sandbox',
      hero: 'Build anything',
      heroSubtitle: 'Describe what you want to build and continue after login.',
      promptPlaceholder: 'Describe your app idea...',
      promptSubmit: 'Get started',
      continueToWorkspace: 'Continue to Workspace',
      signInToStart: 'Sign In to Start',
      signIn: 'Sign In',
      needAccount: 'Need an account?',
      startHere: 'Start here',
    },
  } as const;

  test('renders the build-anything landing with prompt controls', () => {
    const html = renderToStaticMarkup(<PublicLandingSliceView {...baseProps} state="empty" />);

    assert.match(html, /AI Sandbox/);
    assert.match(html, /Build anything/);
    assert.match(html, /Describe what you want to build and continue after login\./);
    assert.match(html, /Describe your app idea\.\.\./);
    assert.match(html, /Get started/);
    assert.match(html, /Sign In/);
    assert.match(html, /Need an account\?/);
    assert.match(html, /Start here/);
    assert.match(html, /textarea/);
  });

  test('uses login and register routes for anonymous visitors', () => {
    const html = renderToStaticMarkup(<PublicLandingSliceView {...baseProps} state="empty" />);

    assert.match(html, /href="\/en\/login"/);
    assert.match(html, /href="\/en\/register"/);
  });

  test('shows continue-to-workspace CTA for ready state', () => {
    const html = renderToStaticMarkup(<PublicLandingSliceView {...baseProps} state="ready" />);

    assert.match(html, /Continue to Workspace/);
    assert.match(html, /href="\/en\/app"/);
    assert.ok(!html.includes('Need an account?'));
  });

  test('keeps authenticated-app scope out of public slice', () => {
    const html = renderToStaticMarkup(<PublicLandingSliceView {...baseProps} state="empty" />);

    assert.ok(!html.includes('History / Control'));
    assert.ok(!html.includes('Dashboard'));
    assert.ok(!html.includes('Timeline'));
    assert.ok(!html.includes('Diff'));
    assert.ok(!html.includes('Revert'));
  });
});
