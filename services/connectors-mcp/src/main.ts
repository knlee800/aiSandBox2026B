import { startStdioServer } from './server';

startStdioServer().catch(() => {
  process.stderr.write('connectors-mcp failed to start\n');
  process.exitCode = 1;
});
