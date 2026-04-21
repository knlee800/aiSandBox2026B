// PROJ-03-A0: Phase A stays behind a build-time kill-switch. Only the exact
// string "true" enables the project-first UX path.
export const PROJECT_FIRST_UX = process.env.NEXT_PUBLIC_PROJECT_FIRST_UX === 'true';
