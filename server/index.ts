import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { db } from './db';
import budgetsRouter from './routes/budgets';
import attestationsRouter from './routes/attestations';
import recipientsRouter from './routes/recipients';

const app = new Hono();

app.use('*', cors({ origin: '*' }));
app.use('*', logger());

app.get('/health', (c) => c.json({ ok: true, ts: Date.now() }));

app.route('/budgets', budgetsRouter);
app.route('/attestations', attestationsRouter);
app.route('/recipients', recipientsRouter);

const port = 3001;

async function main() {
  await db.migrate();
  console.log('Database migrated');

  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`FlowGate API running on port ${info.port}`);
  });
}

main().catch((err) => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});

export type AppType = typeof app;
