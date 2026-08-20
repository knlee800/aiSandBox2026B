import { assertLiveAuthorized } from './lib/modes';

export default function globalSetup(): void {
  assertLiveAuthorized(process.env);
}
