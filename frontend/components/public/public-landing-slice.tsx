'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useState } from 'react';
import LanguageSwitcher from '../LanguageSwitcher';
import { useTranslations } from '../../hooks/useTranslations';
import {
  computePublicLandingState,
  type PublicLandingState,
} from './public-landing-slice.logic';

interface PublicLandingSliceProps {
  locale: string;
}

interface PublicLandingStrings {
  appName: string;
  hero: string;
  heroSubtitle: string;
  promptPlaceholder: string;
  promptSubmit: string;
  continueToWorkspace: string;
  signInToStart: string;
  signIn: string;
  needAccount: string;
  startHere: string;
}

interface PublicLandingSliceViewProps {
  locale: string;
  state: PublicLandingState;
  prompt: string;
  onPromptChange: (value: string) => void;
  onPromptSubmit: () => void;
  strings: PublicLandingStrings;
  headerAuxiliary?: React.ReactNode;
}

export default function PublicLandingSlice(props: PublicLandingSliceProps) {
  const router = useRouter();
  const tLanding = useTranslations('landing');
  const tCommon = useTranslations('common');
  const tLogin = useTranslations('login');
  const [isHydrating, setIsHydrating] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const [hasAccessToken, setHasAccessToken] = useState(false);
  const [prompt, setPrompt] = useState('');

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

  const handlePromptSubmit = () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) {
      return;
    }

    try {
      window.sessionStorage.setItem('aisandbox_pending_prompt', trimmedPrompt);
    } catch {
      // Preserve the redirect path even if browser storage is unavailable.
    }

    router.push(`/${props.locale}/login`);
  };

  return (
    <PublicLandingSliceView
      locale={props.locale}
      state={state}
      prompt={prompt}
      onPromptChange={setPrompt}
      onPromptSubmit={handlePromptSubmit}
      headerAuxiliary={<LanguageSwitcher />}
      strings={{
        appName: tCommon('appName'),
        hero: tLanding('hero'),
        heroSubtitle: tLanding('heroSubtitle'),
        promptPlaceholder: tLanding('promptPlaceholder'),
        promptSubmit: tLanding('promptSubmit'),
        continueToWorkspace: tLanding('continueToWorkspace'),
        signInToStart: tLanding('signInToStart'),
        signIn: tLanding('signIn'),
        needAccount: tLogin('needAccount'),
        startHere: tLogin('startHere'),
      }}
    />
  );
}

export function PublicLandingSliceView(props: PublicLandingSliceViewProps) {
  const primaryHref = props.state === 'ready' ? `/${props.locale}/app` : `/${props.locale}/login`;
  const primaryLabel =
    props.state === 'ready' ? props.strings.continueToWorkspace : props.strings.signInToStart;

  return (
    <main className="min-h-screen bg-surface-base text-text-primary" data-testid="public-landing-slice">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <p className="text-sm font-semibold tracking-wide">{props.strings.appName}</p>
          <div className="flex items-center gap-3">
            {props.headerAuxiliary}
            <Link
              href={primaryHref}
              className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
            >
              {primaryLabel}
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-6xl items-center px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto w-full max-w-3xl">
          <div className="rounded-2xl border border-border bg-surface-raised p-6 shadow-sm sm:p-10">
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              {props.strings.hero}
            </h1>
            <p className="mt-4 max-w-2xl text-base text-text-secondary sm:text-lg">
              {props.strings.heroSubtitle}
            </p>

            <form
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                props.onPromptSubmit();
              }}
            >
              <label className="sr-only" htmlFor="landing-prompt">
                {props.strings.promptPlaceholder}
              </label>
              <textarea
                id="landing-prompt"
                value={props.prompt}
                onChange={(event) => props.onPromptChange(event.target.value)}
                placeholder={props.strings.promptPlaceholder}
                className="min-h-32 w-full rounded-xl border border-border bg-surface-base px-4 py-3 text-base text-text-primary outline-none transition focus:border-brand focus:ring-2 focus:ring-brand"
              />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-md bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover"
                >
                  {props.strings.promptSubmit}
                </button>

                {props.state !== 'ready' ? (
                  <Link
                    href={`/${props.locale}/login`}
                    className="inline-flex items-center justify-center rounded-md border border-border bg-surface-base px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-overlay"
                  >
                    {props.strings.signIn}
                  </Link>
                ) : null}
              </div>
            </form>

            {props.state !== 'ready' ? (
              <p className="mt-4 text-sm text-text-secondary">
                {props.strings.needAccount}{' '}
                <Link
                  href={`/${props.locale}/register`}
                  className="font-medium text-brand transition-colors hover:text-brand-hover hover:underline"
                >
                  {props.strings.startHere}
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
