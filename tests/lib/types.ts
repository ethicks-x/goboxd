// @ts-nocheck
// Shared types for the goboxd HTTP test harness.

export type Expect = {
  httpStatus?: number;
  topStatus?: string;
  buildStatus?: string;
  testStatuses?: string[];
  testStdouts?: (string | RegExp)[];
  errorCode?: string;
  bodyJsonHas?: Record<string, unknown>;
  custom?: (body: any, res: Response) => string | null; // return reason or null
};

export type Case = {
  name: string;
  path?: string;            // default /run
  method?: string;          // default POST
  body?: unknown;           // JSON body; omit for GET
  rawBody?: string;         // overrides body if set (for malformed-JSON tests)
  headers?: Record<string, string>;
  language?: string;        // for skip-when-not-ready logic
  tags?: string[];
  expect: Expect;
};

export type Result = {
  name: string;
  ok: boolean;
  reason?: string;
  skipped?: boolean;
  durationMs?: number;
};

export type SuiteContext = {
  base: string;
  readyz: Record<string, boolean>;
  only?: string;
  langFilter?: string;
  verbose: boolean;
  concurrency: number;       // for load suite
  duration: number;          // seconds, for load suite
  jsonOut: boolean;
};

export type Suite = {
  name: string;
  description: string;
  run(ctx: SuiteContext): Promise<Result[]>;
};
