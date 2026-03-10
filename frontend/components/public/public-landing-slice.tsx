'use client';

import Link from 'next/link';
import React from 'react';
import { useEffect, useMemo, useState } from 'react';
import {
  computePublicLandingState,
  type PublicLandingState,
} from './public-landing-slice.logic';

interface PublicLandingSliceProps {
  locale: string;
}

interface PublicLandingSliceViewProps {
  locale: string;
  state: PublicLandingState;
}

export default function PublicLandingSlice(props: PublicLandingSliceProps) {
  const [isHydrating, setIsHydrating] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [hasAccessToken, setHasAccessToken] = useState(false);

  useEffect(() => {
    try {
      const token = window.localStorage.getItem('access_token');
      setHasAccessToken(Boolean(token));
      setInitError(null);
    } catch {
      setInitError('Unable to access browser storage.');
      setHasAccessToken(false);
    } finally {
      setIsHydrating(false);
    }
  }, []);

  const state = useMemo(
    () =>
      computePublicLandingState({
        isHydrating,
        initError,
        hasAccessToken,
      }),
    [hasAccessToken, initError, isHydrating],
  );

  return <PublicLandingSliceView locale={props.locale} state={state} />;
}

export function PublicLandingSliceView(props: PublicLandingSliceViewProps) {
  const primaryHref = props.state === 'ready' ? `/${props.locale}/app` : `/${props.locale}/login`;
  const primaryLabel = props.state === 'ready' ? 'Continue to Workspace' : 'Sign In to Start';

  return (
    <main className="min-h-screen bg-white text-gray-900" data-testid="public-landing-slice">
      <header className="border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-6 py-4 flex items-center justify-between">
          <p className="text-sm font-semibold">AI Sandbox</p>
          <nav className="flex items-center gap-3 text-sm">
            <Link href={primaryHref} className="rounded bg-blue-600 px-3 py-2 text-white hover:bg-blue-700">
              {primaryLabel}
            </Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-12" data-testid="landing-hero">
        <h1 className="text-3xl font-bold tracking-tight">Build software by chatting with AI in isolated sandboxes.</h1>
        <p className="mt-4 max-w-3xl text-sm text-gray-600">
          Safe, deterministic coding sessions with clear lifecycle controls, preview support, and repeatable behavior.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href={primaryHref} className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            {primaryLabel}
          </Link>
          <Link href={`/${props.locale}/login`} className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Open Login
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-8" data-testid="landing-core-explanation">
        <h2 className="text-lg font-semibold">Core Product Surface</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <article className="rounded border border-gray-200 p-4">
            <h3 className="text-sm font-semibold">Isolated Sessions</h3>
            <p className="mt-2 text-sm text-gray-600">Each coding session runs in its own controlled container.</p>
          </article>
          <article className="rounded border border-gray-200 p-4">
            <h3 className="text-sm font-semibold">Deterministic Behavior</h3>
            <p className="mt-2 text-sm text-gray-600">Request-driven lifecycle and explicit terminal semantics.</p>
          </article>
          <article className="rounded border border-gray-200 p-4">
            <h3 className="text-sm font-semibold">AI-Assisted Workflow</h3>
            <p className="mt-2 text-sm text-gray-600">Generate, run, and iterate with guided AI interactions.</p>
          </article>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-12" data-testid="landing-state">
        {props.state === 'loading' ? <p className="text-sm text-gray-500">Loading public surface...</p> : null}
        {props.state === 'error' ? (
          <p className="text-sm text-red-600">Unable to initialize this public surface. You can still continue to login.</p>
        ) : null}
        {props.state === 'empty' ? (
          <p className="text-sm text-gray-600">You are viewing the public landing slice. Sign in to enter the product.</p>
        ) : null}
        {props.state === 'ready' ? (
          <p className="text-sm text-green-700">Signed-in state detected. Continue directly to your workspace.</p>
        ) : null}
      </section>
    </main>
  );
}
