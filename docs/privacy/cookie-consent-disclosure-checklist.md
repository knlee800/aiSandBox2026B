# Cookie / Consent / Disclosure Operational Checklist

**Phase:** 64B  
**Reference:** PHASE-64A-DESIGN.md Section 3.3, 3.4

---

## Purpose

Operational checklist for cookie, consent, and disclosure requirements per Phase 64A. Use when publishing or updating Privacy Policy, Terms, Cookie Notice, or when verifying consent/disclosure compliance.

## Scope

**When to use:**
- Before production launch (Privacy Policy, Terms, Cookie Notice published)
- When adding optional cookies or analytics
- When updating Privacy Policy or Terms
- When changing third-party data sharing (e.g. AI providers)
- Annual or policy-driven review

## Pre-Launch Checklist

| Check | Requirement | Status |
|-------|-------------|--------|
| Privacy Policy | Published; linked from frontend/signup/settings | [ ] |
| Terms of Service | Published; linked from frontend/signup | [ ] |
| Cookie Notice | Published; types of cookies documented | [ ] |
| Contact for requests | Designated email or form in Privacy Policy | [ ] |
| Data collected | Documented in Privacy Policy | [ ] |
| Third-party disclosure | AI providers (Anthropic, OpenAI, Google) disclosed | [ ] |
| User rights | Access, export, deletion, correction (with limitations) | [ ] |
| Retention | Retention periods per data category documented | [ ] |

## Cookie Checklist

| Check | Requirement | Status |
|-------|-------------|--------|
| Essential cookies | Documented (session/auth; required for service) | [ ] |
| Optional cookies | If any: documented; consent obtained before use | [ ] |
| Third-party cookies | If frontend embeds analytics: disclosed | [ ] |
| Management | How user can manage or disable non-essential cookies | [ ] |

## Consent Checklist

| Scenario | Requirement | Status |
|----------|-------------|--------|
| Account creation | User agrees to Terms and Privacy Policy (explicit or by use) | [ ] |
| AI execution | Disclosure that prompts/responses sent to third-party AI providers | [ ] |
| Optional tracking | Consent before non-essential cookies or analytics | [ ] |
| Policy changes | Notice of material changes; continued use may constitute acceptance | [ ] |

## Disclosure Checklist

| Disclosure | Requirement | Status |
|------------|-------------|--------|
| Data minimization | Per PHASE-15B: no prompts, no AI responses logged | [ ] |
| Purpose | Session management, AI execution, billing/usage | [ ] |
| AI providers | Anthropic, OpenAI, Google receive prompts/responses | [ ] |
| No other third parties | Per current architecture; document if changed | [ ] |

## Policy Update Procedure

1. **Draft** — Update Privacy Policy, Terms, or Cookie Notice.
2. **Review** — Platform owner or legal review.
3. **Version** — Document version and publication date.
4. **Publish** — Update published documents; link from frontend.
5. **Notify** — If material change: notify users per policy (email, in-app, etc.).
6. **Evidence** — Retain version history, publication date, notification method.

## Signoff

- Pre-launch checklist: Platform owner sign-off
- Policy update: Platform owner sign-off
- Annual review: Document findings; platform owner sign-off

---

**Reference:** PHASE-64A-DESIGN.md Section 3.3, 3.4
