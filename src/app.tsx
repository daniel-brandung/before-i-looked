import { Hono } from 'hono';
import { loadConfig, type RigConfig } from './config.js';
import { readNight } from './digest/read.js';
import { lane } from './lane.js';
import { readStatus } from './status.js';
import { DigestMissing, DigestPage } from './views/digest.js';
import { Layout } from './views/layout.js';
import { StatusBoard } from './views/status.js';

export function createApp(config: RigConfig = loadConfig()) {
  const app = new Hono();

  app.get('/health', (c) => c.json({ ok: true, lane: lane().id }));

  app.get('/', (c) =>
    c.html(
      <Layout title="status" lane={lane()}>
        <StatusBoard status={readStatus(config)} />
      </Layout>,
    ),
  );

  app.get('/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = readNight(config.runsDir, night);
    if (!result.found) {
      return c.html(
        <Layout title={`digest · ${night}`} lane={lane()}>
          <DigestMissing night={night} />
        </Layout>,
        404,
      );
    }
    return c.html(
      <Layout title={`digest · ${night}`} lane={lane()}>
        <DigestPage night={result} />
      </Layout>,
    );
  });

  // Same reader as the page, same rows in the same order: the two can't disagree (ADR 0001).
  app.get('/api/digest/:night', (c) => {
    const night = c.req.param('night');
    const result = readNight(config.runsDir, night);
    if (!result.found) {
      return c.json({ night, error: 'no run log for this night' }, 404);
    }
    return c.json({
      night: result.night,
      rows: result.rows,
      counts: result.counts,
      badLines: result.badLines,
    });
  });

  return app;
}
