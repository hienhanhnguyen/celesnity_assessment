
import { createApp } from './app.ts';

const port = Number(process.env.FIXTURES_PORT ?? 4000);
const app = createApp();

const server = app.listen(port, () => {
  console.log(`[fixtures] Application API + supplier crawler listening on :${port}`);
});

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
