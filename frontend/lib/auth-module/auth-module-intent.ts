const NEGATIVE_BLOCKLIST_TERMS = [
  'explain',
  'how does',
  'how do',
  'what is',
  'what are',
  'tell me about',
  'describe',
  'difference between',
  'compare',
  'conceptually',
  'best practice',
  'should i',
  'when to use',
  'why use',
  'check my',
  'debug',
  'review my',
] as const;

const ACTION_VERB_TERMS = [
  'add',
  'install',
  'set up',
  'setup',
  'integrate',
  'implement',
  'configure',
  'create',
  'build',
  'include',
  'wire up',
  'wire in',
] as const;

const AUTH_SUBJECT_TERMS = [
  'authentication',
  'auth',
  'login',
  'sign in',
  'signin',
  'signup',
  'sign up',
  'register',
  'registration',
  'user account',
  'user login',
  'auth.js',
  'nextauth',
  'next-auth',
  'credentials login',
  'credential auth',
] as const;

function includesAnyTerm(input: string, terms: readonly string[]): boolean {
  return terms.some((term) => input.includes(term));
}

export function detectAuthModuleIntent(prompt: string): boolean {
  const normalizedPrompt = prompt.trim().toLowerCase();
  if (!normalizedPrompt) {
    return false;
  }

  if (includesAnyTerm(normalizedPrompt, NEGATIVE_BLOCKLIST_TERMS)) {
    return false;
  }

  const hasActionVerb = includesAnyTerm(normalizedPrompt, ACTION_VERB_TERMS);
  const hasAuthSubject = includesAnyTerm(normalizedPrompt, AUTH_SUBJECT_TERMS);
  return hasActionVerb && hasAuthSubject;
}
