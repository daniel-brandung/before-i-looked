import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const result = readNight('runs', '2026-10-28');

  it('reads 5 jobs, sorted by job, one row each', () => {
    expect(result.found).toBe(true);
    if (!result.found) return;
    expect(result.rows).toEqual([
      {
        job: 'digest/render',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-29T05:41:09+01:00',
        lastAt: '2026-10-29T05:41:09+01:00',
      },
      {
        job: 'fixtures/refresh',
        owner: 'rook',
        runs: 4,
        retries: 3,
        lastStatus: 'ok',
        lastError: 'upstream 503',
        firstAt: '2026-10-29T01:30:00+01:00',
        lastAt: '2026-10-29T01:37:00+01:00',
      },
      {
        job: 'lane/sync',
        owner: 'rook',
        runs: 8,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'lock held',
        firstAt: '2026-10-28T23:00:06+01:00',
        lastAt: '2026-10-29T05:00:04+01:00',
      },
      {
        job: 'notes/backup',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'fail',
        lastError: 'quota exceeded',
        firstAt: '2026-10-29T04:00:01+01:00',
        lastAt: '2026-10-29T04:00:01+01:00',
      },
      {
        job: 'rig/rotate-logs',
        owner: 'lane-07',
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        firstAt: '2026-10-28T23:00:02+01:00',
        lastAt: '2026-10-28T23:00:02+01:00',
      },
    ]);
  });

  it('counts run lines by status and the one bad line', () => {
    if (!result.found) throw new Error('night not found');
    expect(result.counts).toEqual({ ok: 10, retry: 4, fail: 1 });
    expect(result.badLines).toBe(1);
  });
});

describe('readNight edge cases (temp runs dir)', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'rig-read-'));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('a night with no file is not found', () => {
    expect(readNight(dir, '2026-11-01')).toEqual({ found: false, night: '2026-11-01' });
  });

  it('a night that is not YYYY-MM-DD is not found', () => {
    writeFileSync(join(dir, 'latest.jsonl'), '');
    expect(readNight(dir, 'latest')).toEqual({ found: false, night: 'latest' });
    expect(readNight(dir, '../runs/2026-10-28')).toEqual({ found: false, night: '../runs/2026-10-28' });
  });

  it('an empty file is found with no rows', () => {
    writeFileSync(join(dir, '2026-11-01.jsonl'), '');
    expect(readNight(dir, '2026-11-01')).toEqual({
      found: true,
      night: '2026-11-01',
      rows: [],
      counts: { ok: 0, retry: 0, fail: 0 },
      badLines: 0,
    });
  });

  it('keeps the owner from the last line, null included', () => {
    writeFileSync(
      join(dir, '2026-11-01.jsonl'),
      [
        '{"at":"2026-11-01T01:00:00+01:00","job":"a","status":"ok","owner":"rook"}',
        '{"at":"2026-11-01T02:00:00+01:00","job":"a","status":"ok","owner":null}',
      ].join('\n') + '\n',
    );
    const result = readNight(dir, '2026-11-01');
    if (!result.found) throw new Error('night not found');
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.owner).toBeNull();
  });

  it('counts bad lines, skips blank lines, never throws', () => {
    writeFileSync(
      join(dir, '2026-11-01.jsonl'),
      [
        '{"at":"2026-11-01T01:00:00+01:00","job":"a","status":"retry","owner":"rook","error":"boom"}',
        '',
        '   ',
        'not json',
        '{"at":"2026-11-01T01:05:00+01:00","job":"a","status":"maybe","owner":"rook"}',
        '{"job":"a","status":"ok","owner":"rook"}',
        '{"at":"2026-11-01T01:06:00+01:00","job":42,"status":"ok","owner":"rook"}',
        '[1,2]',
        '{"at":"2026-11-01T01:10:00+01:00","job":"a","status":"ok","owner":"rook"}',
      ].join('\n'),
    );
    const result = readNight(dir, '2026-11-01');
    if (!result.found) throw new Error('night not found');
    expect(result.badLines).toBe(5);
    expect(result.counts).toEqual({ ok: 1, retry: 1, fail: 0 });
    expect(result.rows).toEqual([
      {
        job: 'a',
        owner: 'rook',
        runs: 2,
        retries: 1,
        lastStatus: 'ok',
        lastError: 'boom',
        firstAt: '2026-11-01T01:00:00+01:00',
        lastAt: '2026-11-01T01:10:00+01:00',
      },
    ]);
  });

  it('a file with only bad lines is found with no rows', () => {
    writeFileSync(join(dir, '2026-11-01.jsonl'), '{oops\n');
    const result = readNight(dir, '2026-11-01');
    expect(result).toMatchObject({ found: true, rows: [], badLines: 1 });
  });
});
