export type PublicLandingState = 'loading' | 'error' | 'empty' | 'ready';

export interface PublicLandingStateInput {
  isHydrating: boolean;
  initError: string | null;
  hasAccessToken: boolean;
}

export function computePublicLandingState(input: PublicLandingStateInput): PublicLandingState {
  if (input.isHydrating) {
    return 'loading';
  }

  if (input.initError) {
    return 'error';
  }

  return input.hasAccessToken ? 'ready' : 'empty';
}
