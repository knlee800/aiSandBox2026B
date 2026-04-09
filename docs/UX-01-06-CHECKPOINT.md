# UX-01-06 CHECKPOINT — Add Registration Link Or CTA To Login Page

## Task Metadata

- Task ID: UX-01-06
- Title: Add Registration Link Or CTA To Login Page
- Nature: UX FIX (IMPORTANT, LOGIN FLOW)
- Status: COMPLETE and LOCKED
- Checkpoint: `docs/UX-01-06-CHECKPOINT.md`

## Objective

Add a clear registration path/CTA on the login page so users who need an account have an obvious path forward.

## Scope Implemented

- Updated `frontend/app/[locale]/login/page.tsx` only.
- Added a concise CTA below the login submit button:
  - `Need an account? Start here`
  - Link target: `/${locale}` (the existing public app route).
- Preserved existing login form fields, submit button, error rendering, and language switcher behavior.
- Preserved existing login submit flow (`handleLogin` → `POST /api/auth/login`).

## Out of Scope Confirmation

- No auth-system redesign.
- No onboarding redesign.
- No registration-flow redesign beyond link/CTA clarity.
- No unrelated style cleanup.

## Validation

- Source validation confirms login page now includes a clear registration CTA and route:
  - `Need an account? Start here`
  - Link points to `/${locale}`.
- Login submit flow remains unchanged in `handleLogin` (`POST /api/auth/login`), including existing token storage and navigation.
- Existing error handling remains unchanged (`setError(err.response?.data?.message || t('loginFailed'))`).
- `npx tsc -p tsconfig.json --noEmit` (in `frontend`) — PASS.

