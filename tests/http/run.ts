#!/usr/bin/env bun
// @ts-nocheck

// HTTP test suite for goboxd. Run the server locally first:
//   make run         (docker)   or     go run ./cmd/goboxd
// Then:
//   bun tests/http/run.ts
//   BASE_URL=http://localhost:8080 bun tests/http/run.ts
//   bun tests/http/run.ts --only=py3   (filter by substring)

const BASE = process.env.BASE_URL ?? "http://localhost:8080";
const ONLY = process.argv.find((a) => a.startsWith("--only="))?.slice(7);

type Expect = {
  httpStatus?: number;
  topStatus?: string;
  buildStatus?: string;
  testStatuses?: string[];
  testStdouts?: (string | RegExp)[];
  errorCode?: string;
  bodyJsonHas?: Record<string, unknown>;
};

type Case = {
  name: string;
  path?: string;          // default /run
  method?: string;        // default POST
  body?: unknown;         // JSON body; omit for GET
  rawBody?: string;       // overrides body if set (for malformed-JSON tests)
  expect: Expect;
};

const C = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

const cases: Case[] = [
  // --- health / info ---
  {
    name: "GET /healthz returns 200 ok",
    path: "/healthz",
    method: "GET",
    expect: { httpStatus: 200, bodyJsonHas: { status: "ok" } },
  },
  {
    name: "GET /readyz responds (200 or 503)",
    path: "/readyz",
    method: "GET",
    expect: {}, // status checked specially below
  },
  {
    name: "GET /info returns 200 with languages",
    path: "/info",
    method: "GET",
    expect: { httpStatus: 200 },
  },

  // --- py3 happy paths ---
  {
    name: "py3: hello world accepted",
    body: {
      language: "py3",
      source: "print('hi')",
      tests: [{ stdin: "", expected_stdout: "hi\n" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      testStatuses: ["accepted"],
      testStdouts: ["hi\n"],
    },
  },
  {
    name: "py3: echoes stdin",
    body: {
      language: "py3",
      source: "import sys\nsys.stdout.write(sys.stdin.read().upper())",
      tests: [{ stdin: "hello\n", expected_stdout: "HELLO\n" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      testStatuses: ["accepted"],
    },
  },
  {
    name: "py3: wrong output",
    body: {
      language: "py3",
      source: "print('nope')",
      tests: [{ stdin: "", expected_stdout: "hi" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "wrong_output",
      testStatuses: ["wrong_output"],
    },
  },
  {
    name: "py3: runtime error",
    body: {
      language: "py3",
      source: "raise SystemExit(1)",
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "runtime_error",
      testStatuses: ["runtime_error"],
    },
  },
  {
    name: "py3: time exceeded",
    body: {
      language: "py3",
      source: "while True: pass",
      run: { limits: { wall_time_s: 1 } },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "time_exceeded",
      testStatuses: ["time_exceeded"],
    },
  },
  {
    name: "py3: first failing test sets top-level status",
    body: {
      language: "py3",
      source:
        "import sys\nn=int(sys.stdin.read())\nprint(n*2)",
      tests: [
        { stdin: "2", expected_stdout: "4\n" },
        { stdin: "3", expected_stdout: "999\n" }, // wrong
        { stdin: "4", expected_stdout: "8\n" },
      ],
    },
    expect: {
      httpStatus: 200,
      topStatus: "wrong_output",
      testStatuses: ["accepted", "wrong_output", "accepted"],
    },
  },

  // --- compiled ---
  {
    name: "cpp: hello world accepted",
    body: {
      language: "cpp",
      source:
        '#include <iostream>\nint main(){ std::cout << "hi"; return 0; }',
      tests: [{ stdin: "", expected_stdout: "hi" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      buildStatus: "ok",
      testStatuses: ["accepted"],
    },
  },
  {
    name: "cpp: build failure -> build_failed + not_executed",
    body: {
      language: "cpp",
      source: "int main(){ this is not valid c++ ; }",
      tests: [{ stdin: "", expected_stdout: "anything" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "build_failed",
      buildStatus: "failed",
      testStatuses: ["not_executed"],
    },
  },
  {
    name: "c: hello world accepted",
    body: {
      language: "c",
      source: '#include <stdio.h>\nint main(){printf("hi");return 0;}',
      build: { flags: ["-O2"] },
      tests: [{ stdin: "", expected_stdout: "hi" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      buildStatus: "ok",
      testStatuses: ["accepted"],
    },
  },

  // --- js / java (skipped silently if /readyz says unavailable) ---
  {
    name: "js: hello world accepted",
    body: {
      language: "js",
      source: "process.stdout.write('hi')",
      tests: [{ stdin: "", expected_stdout: "hi" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      testStatuses: ["accepted"],
    },
  },
  {
    name: "java: hello world accepted",
    body: {
      language: "java",
      source:
        "public class Solution { public static void main(String[] a){ System.out.print(\"hi\"); } }",
      source_filename: "Solution.java",
      artifact_filename: "Solution",
      tests: [{ stdin: "", expected_stdout: "hi" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      buildStatus: "ok",
      testStatuses: ["accepted"],
    },
  },

  // --- 400 error cases ---
  {
    name: "400: unknown language",
    body: {
      language: "brainfuck",
      source: "+",
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: malformed JSON",
    rawBody: "{not json",
    expect: { httpStatus: 400 },
  },
  {
    name: "400: empty tests array",
    body: { language: "py3", source: "print(1)", tests: [] },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: path-traversal source_filename",
    body: {
      language: "py3",
      source: "print(1)",
      source_filename: "../../etc/passwd",
      tests: [{ stdin: "", expected_stdout: "1" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: absolute source_filename",
    body: {
      language: "py3",
      source: "print(1)",
      source_filename: "/tmp/x.py",
      tests: [{ stdin: "", expected_stdout: "1" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: disallowed compile flag",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["-fplugin=/tmp/evil.so"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: oversize source",
    body: {
      language: "py3",
      source: "x='" + "A".repeat(300_000) + "'\nprint('hi')",
      tests: [{ stdin: "", expected_stdout: "hi" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "405/404 on GET /run",
    path: "/run",
    method: "GET",
    expect: {}, // checked specially
  },
];

// ---------- runner ----------

type Result = { name: string; ok: boolean; reason?: string; skipped?: boolean };

async function readyzLanguages(): Promise<Record<string, boolean>> {
  try {
    const r = await fetch(`${BASE}/readyz`);
    const j: any = await r.json().catch(() => ({}));
    const langs = j?.languages ?? {};
    const out: Record<string, boolean> = {};
    for (const k of Object.keys(langs)) out[k] = !!langs[k]?.ok;
    return out;
  } catch {
    return {};
  }
}

function shallowHas(body: any, expect: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(expect)) {
    if (JSON.stringify(body?.[k]) !== JSON.stringify(v)) {
      return `body.${k} expected ${JSON.stringify(v)} got ${JSON.stringify(body?.[k])}`;
    }
  }
  return null;
}

function matchStdout(actual: string, expected: string | RegExp): boolean {
  return expected instanceof RegExp ? expected.test(actual) : actual === expected;
}

async function runCase(c: Case, readyz: Record<string, boolean>): Promise<Result> {
  // Skip language cases when /readyz reports the language unavailable.
  const lang = (c.body as any)?.language;
  if (lang && Object.keys(readyz).length && readyz[lang] === false) {
    return { name: c.name, ok: true, skipped: true, reason: `${lang} not ready` };
  }

  const method = c.method ?? "POST";
  const path = c.path ?? "/run";
  const url = `${BASE}${path}`;

  let res: Response;
  try {
    const init: RequestInit = { method };
    if (c.rawBody !== undefined) {
      init.body = c.rawBody;
      init.headers = { "Content-Type": "application/json" };
    } else if (c.body !== undefined) {
      init.body = JSON.stringify(c.body);
      init.headers = { "Content-Type": "application/json" };
    }
    res = await fetch(url, init);
  } catch (e: any) {
    return { name: c.name, ok: false, reason: `fetch failed: ${e.message}` };
  }

  // Special-case the readyz / GET /run cases.
  if (c.name.startsWith("GET /readyz")) {
    return res.status === 200 || res.status === 503
      ? { name: c.name, ok: true }
      : { name: c.name, ok: false, reason: `expected 200 or 503, got ${res.status}` };
  }
  if (c.name === "405/404 on GET /run") {
    return res.status === 405 || res.status === 404
      ? { name: c.name, ok: true }
      : { name: c.name, ok: false, reason: `expected 405 or 404, got ${res.status}` };
  }

  const e = c.expect;

  if (e.httpStatus !== undefined && res.status !== e.httpStatus) {
    const text = await res.text().catch(() => "");
    return {
      name: c.name,
      ok: false,
      reason: `expected HTTP ${e.httpStatus}, got ${res.status}: ${text.slice(0, 160)}`,
    };
  }

  let body: any = null;
  const text = await res.text();
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    return { name: c.name, ok: false, reason: `non-JSON response: ${text.slice(0, 160)}` };
  }

  if (e.bodyJsonHas) {
    const err = shallowHas(body, e.bodyJsonHas);
    if (err) return { name: c.name, ok: false, reason: err };
  }
  if (e.errorCode && body?.error?.code !== e.errorCode) {
    return {
      name: c.name,
      ok: false,
      reason: `error.code expected ${e.errorCode}, got ${body?.error?.code}`,
    };
  }
  if (e.topStatus !== undefined && body?.status !== e.topStatus) {
    return {
      name: c.name,
      ok: false,
      reason: `top status expected ${e.topStatus}, got ${body?.status}`,
    };
  }
  if (e.buildStatus !== undefined && body?.build?.status !== e.buildStatus) {
    return {
      name: c.name,
      ok: false,
      reason: `build.status expected ${e.buildStatus}, got ${body?.build?.status}`,
    };
  }
  if (e.testStatuses) {
    const got = (body?.tests ?? []).map((t: any) => t?.status);
    if (JSON.stringify(got) !== JSON.stringify(e.testStatuses)) {
      return {
        name: c.name,
        ok: false,
        reason: `tests[].status expected ${JSON.stringify(e.testStatuses)}, got ${JSON.stringify(got)}`,
      };
    }
  }
  if (e.testStdouts) {
    const tests = body?.tests ?? [];
    for (let i = 0; i < e.testStdouts.length; i++) {
      if (!matchStdout(tests[i]?.stdout ?? "", e.testStdouts[i])) {
        return {
          name: c.name,
          ok: false,
          reason: `tests[${i}].stdout expected ${e.testStdouts[i]}, got ${JSON.stringify(tests[i]?.stdout)}`,
        };
      }
    }
  }

  return { name: c.name, ok: true };
}

async function main() {
  console.log(`${C.bold}goboxd HTTP tests${C.reset}  ${C.dim}→ ${BASE}${C.reset}\n`);

  // Quick reachability check.
  try {
    await fetch(`${BASE}/healthz`);
  } catch (e: any) {
    console.error(
      `${C.red}cannot reach ${BASE} — is the server running?${C.reset}\n  ${e.message}`,
    );
    process.exit(2);
  }

  const readyz = await readyzLanguages();
  if (Object.keys(readyz).length) {
    const summary = Object.entries(readyz)
      .map(([k, v]) => `${k}=${v ? "ok" : "down"}`)
      .join(" ");
    console.log(`${C.dim}readyz: ${summary}${C.reset}\n`);
  }

  const filtered = ONLY
    ? cases.filter((c) => c.name.toLowerCase().includes(ONLY.toLowerCase()))
    : cases;

  const results: Result[] = [];
  for (const c of filtered) {
    process.stdout.write(`${C.dim}…${C.reset} ${c.name}`);
    const r = await runCase(c, readyz);
    results.push(r);
    const tag = r.skipped
      ? `${C.yellow}SKIP${C.reset}`
      : r.ok
        ? `${C.green}PASS${C.reset}`
        : `${C.red}FAIL${C.reset}`;
    process.stdout.write(`\r${tag} ${c.name}`);
    if (r.reason) process.stdout.write(`  ${C.dim}(${r.reason})${C.reset}`);
    process.stdout.write("\n");
  }

  const pass = results.filter((r) => r.ok && !r.skipped).length;
  const skip = results.filter((r) => r.skipped).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(
    `\n${C.bold}${pass} passed${C.reset}, ${C.yellow}${skip} skipped${C.reset}, ${fail ? C.red : C.dim}${fail} failed${C.reset}`,
  );
  process.exit(fail ? 1 : 0);
}

main();
