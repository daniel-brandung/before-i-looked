import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /api/digest/:night', () => {
  const app = createApp({ ...loadConfig(), runsDir: 'runs' });
  it('200 with the page rows for a night on disk, 404 for none', async () => {
    const ok = await app.request('/api/digest/2026-10-28');
    expect(ok.status).toBe(200);
    const body = (await ok.json()) as { rows: { job: string }[] };
    expect(body.rows.map((r) => r.job)).toEqual([...body.rows.map((r) => r.job)].sort());
    expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
  });
});
