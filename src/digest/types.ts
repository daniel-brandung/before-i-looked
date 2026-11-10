// Contract for the night reader (plan.md § 1). § 2a–2d build against this file only;
// the reader itself (#2) implements `ReadNight` and exports it as `readNight` from
// `src/digest/read.ts`.

// A run line's status, as written in runs/<night>.jsonl.
export type RunStatus = 'ok' | 'retry' | 'fail';

// One row per job for the night.
export type DigestRow = {
  job: string;
  // Owner on the job's last run line. null when the log says null: keep the row, show `—`.
  owner: string | null;
  // Run lines for this job, every status included.
  runs: number;
  // Run lines for this job with status 'retry'.
  retries: number;
  // Status of the job's last run line.
  lastStatus: RunStatus;
  // `error` of the job's latest run line that carried one; null when none did (show `—`).
  lastError: string | null;
  // `at` of the job's first and last run line, in file order. Verbatim from the log:
  // offset kept, never converted to UTC.
  firstAt: string;
  lastAt: string;
};

// Run lines by status across the whole night (the board's ok / retry / fail counts).
export type StatusCounts = Record<RunStatus, number>;

// A night that has a file on disk.
export type NightFound = {
  found: true;
  night: string;
  // Already sorted by job (string order). The page and the JSON show them as given and
  // never sort on their own, so the two can't disagree. Empty = the night is
  // "nothing ran" (an empty file, or one with only bad lines).
  rows: DigestRow[];
  counts: StatusCounts;
  // Non-blank lines that didn't parse as a run line. Counted, never thrown; blank lines
  // are skipped and not counted.
  badLines: number;
};

// No runs/<night>.jsonl, or `night` isn't a YYYY-MM-DD date: the routes answer 404.
export type NightMissing = {
  found: false;
  night: string;
};

export type NightResult = NightFound | NightMissing;

// Reads runs/<night>.jsonl from `runsDir` (night = YYYY-MM-DD). Synchronous, like
// nightsOnDisk. Never throws for a missing file or bad lines; only for I/O failures on
// a file that exists.
export type ReadNight = (runsDir: string, night: string) => NightResult;
