import { Logger } from '@nestjs/common';
import { runLiveCli } from './live-run';

if (require.main === module) {
  // The Anthropic adapter logs through Nest. Silence that so stdout is only
  // the task lines, and so an adapter error log cannot echo the API key.
  Logger.overrideLogger(false);
  runLiveCli(process.argv.slice(2))
    .then((code) => {
      process.exit(code);
    })
    .catch(() => {
      process.stderr.write('live eval failed\n');
      process.exit(1);
    });
}
