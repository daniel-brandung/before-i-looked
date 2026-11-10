import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

describe('GET /digest/:night', () => {
  const app = createApp({ ...loadConfig(), runsDir: 'runs' });
  it('200 for a night on disk, 404 for none', async () => {
    expect((await app.request('/digest/2026-10-28')).status).toBe(200);
    expect((await app.request('/digest/2026-01-01')).status).toBe(404);
  });
});
