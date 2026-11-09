import { Logger } from '@nestjs/common';
import { runBriefingLiveCli } from './briefing-live-run';

if (require.main === module) {
  // The Anthropic adapter logs through Nest. Silence that so stdout is only
  // the case lines, and so an adapter error log cannot echo the API key.
  Logger.overrideLogger(false);
  runBriefingLiveCli(process.argv.slice(2))
    .then((code) => {
      process.exit(code);
    })
    .catch(() => {
      process.stderr.write('briefing live eval failed\n');
      process.exit(1);
    });
}
