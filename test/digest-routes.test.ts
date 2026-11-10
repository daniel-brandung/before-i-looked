import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

// Own fixtures in a temp runs dir; runs/ is read-only and never touched here.
const GOOD_NIGHT = '2026-10-28';
const EMPTY_NIGHT = '2026-10-27';
const BAD_LINE_NIGHT = '2026-10-26';
const MISSING_NIGHT = '2026-01-01';

const line = (job: string, status: string, at: string, owner: string | null = 'rook') =>
  JSON.stringify({ at, job, status, owner });

// Written out of order on purpose: the reader sorts by job, the routes must show that order.
const GOOD_LINES = [
  line('lane/sync', 'ok', '2026-10-28T23:00:06+01:00'),
  line('notes/backup', 'fail', '2026-10-28T04:00:01+01:00', 'lane-07'),
  line('digest/render', 'retry', '2026-10-28T05:41:00+01:00', null),
  line('lane/sync', 'retry', '2026-10-28T23:10:00+01:00'),
  line('digest/render', 'ok', '2026-10-28T05:42:00+01:00', null),
];

let runsDir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
  writeFileSync(join(runsDir, `${GOOD_NIGHT}.jsonl`), GOOD_LINES.join('\n') + '\n');
  writeFileSync(join(runsDir, `${EMPTY_NIGHT}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD_LINE_NIGHT}.jsonl`),
    [line('lane/sync', 'ok', '2026-10-26T23:00:00+01:00'), 'this is not json', line('lane/sync', 'ok', '2026-10-26T23:05:00+01:00')].join('\n') +
      '\n',
  );
  app = createApp({ ...loadConfig(), runsDir });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('200 for a night with a file, jobs in sorted order, failed and retry-heavy rows marked', async () => {
    const res = await app.request(`/digest/${GOOD_NIGHT}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    const order = ['digest/render', 'lane/sync', 'notes/backup'].map((job) => html.indexOf(`<td>${job}</td>`));
    expect(order.every((i) => i > -1)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(html).toContain('<td>—</td>'); // digest/render has a null owner
    expect(html).toContain('class="warn"'); // notes/backup ends on fail
    expect(html).not.toContain('unreadable line');
  });

  it('404 for a night with no file', async () => {
    const res = await app.request(`/digest/${MISSING_NIGHT}`);
    expect(res.status).toBe(404);
    expect(await res.text()).toContain(`no run log for ${MISSING_NIGHT}`);
  });

  it('200 and "nothing ran" for an empty night', async () => {
    const res = await app.request(`/digest/${EMPTY_NIGHT}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('nothing ran');
    expect(html).not.toContain('<table');
  });

  it('200 with the good rows and the bad-line count for a night with a bad line', async () => {
    const res = await app.request(`/digest/${BAD_LINE_NIGHT}`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<td>lane/sync</td>');
    expect(html).toContain('1 unreadable line(s) skipped');
  });
});

describe('GET /api/digest/:night', () => {
  it('200 with the rows in sorted order and the night counts', async () => {
    const res = await app.request(`/api/digest/${GOOD_NIGHT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      night: string;
      rows: { job: string; runs: number; retries: number; lastStatus: string; owner: string | null }[];
      counts: Record<string, number>;
      badLines: number;
    };
    expect(body.night).toBe(GOOD_NIGHT);
    expect(body.rows.map((r) => r.job)).toEqual(['digest/render', 'lane/sync', 'notes/backup']);
    expect(body.rows[0]).toMatchObject({ job: 'digest/render', owner: null, runs: 2, retries: 1, lastStatus: 'ok' });
    expect(body.rows[1]).toMatchObject({ job: 'lane/sync', owner: 'rook', runs: 2, retries: 1, lastStatus: 'retry' });
    expect(body.counts).toEqual({ ok: 2, retry: 2, fail: 1 });
    expect(body.badLines).toBe(0);
  });

  it('404 with an error for a night with no file', async () => {
    const res = await app.request(`/api/digest/${MISSING_NIGHT}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ night: MISSING_NIGHT, error: 'no run log for this night' });
  });

  it('200 with rows: [] for an empty night', async () => {
    const res = await app.request(`/api/digest/${EMPTY_NIGHT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: unknown[]; badLines: number };
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('200 with the good rows and badLines: 1 for a night with a bad line', async () => {
    const res = await app.request(`/api/digest/${BAD_LINE_NIGHT}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { rows: { job: string; runs: number }[]; badLines: number };
    expect(body.rows).toEqual([expect.objectContaining({ job: 'lane/sync', runs: 2 })]);
    expect(body.badLines).toBe(1);
  });
});
