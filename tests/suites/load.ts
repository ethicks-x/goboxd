// @ts-nocheck
// Load suite: hammer /run with concurrent clients, measure latency and verify
// the daemon queues rather than rejects (bounded concurrency contract).

import { Suite, Result } from "../lib/types";
import { send } from "../lib/client";
import { C } from "../lib/colors";

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

type ScenarioResult = {
  label: string;
  total: number;
  ok: number;
  http5xx: number;
  http4xx: number;
  topAccepted: number;
  durationsMs: number[];
  wallMs: number;
};

async function runScenario(
  base: string,
  label: string,
  concurrency: number,
  totalRequests: number,
  bodyFactory: () => any,
): Promise<ScenarioResult> {
  const r: ScenarioResult = {
    label,
    total: totalRequests,
    ok: 0,
    http5xx: 0,
    http4xx: 0,
    topAccepted: 0,
    durationsMs: [],
    wallMs: 0,
  };
  let issued = 0;
  const wallStart = performance.now();

  async function worker() {
    while (true) {
      const i = issued++;
      if (i >= totalRequests) return;
      try {
        const res = await send({ base, path: "/run", method: "POST", body: bodyFactory() });
        r.durationsMs.push(res.durationMs);
        if (res.status >= 500) r.http5xx++;
        else if (res.status >= 400) r.http4xx++;
        else r.ok++;
        if (res.json?.status === "accepted") r.topAccepted++;
      } catch {
        r.http5xx++;
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  r.wallMs = performance.now() - wallStart;
  return r;
}

function printScenario(r: ScenarioResult) {
  const s = [...r.durationsMs].sort((a, b) => a - b);
  const p50 = quantile(s, 0.5).toFixed(0);
  const p95 = quantile(s, 0.95).toFixed(0);
  const p99 = quantile(s, 0.99).toFixed(0);
  const rps = (r.total / (r.wallMs / 1000)).toFixed(1);
  console.log(
    `  ${C.bold}${r.label}${C.reset}  ` +
      `n=${r.total} ok=${r.ok} 4xx=${r.http4xx} 5xx=${r.http5xx} acc=${r.topAccepted}  ` +
      `wall=${(r.wallMs / 1000).toFixed(2)}s  rps=${rps}  p50=${p50}ms p95=${p95}ms p99=${p99}ms`,
  );
}

const pyHello = () => ({
  language: "py3",
  source: "import sys;sys.stdout.write('hi')",
  tests: [{ stdin: "", expected_stdout: "hi" }],
});

const pySleep = () => ({
  language: "py3",
  source: "import time;time.sleep(0.5);print('done',end='')",
  run: { limits: { wall_time_s: 5 } },
  tests: [{ stdin: "", expected_stdout: "done" }],
});

const pyOom = () => ({
  language: "py3",
  source: "x=bytearray(512*1024*1024)\nprint('done',end='')",
  run: { limits: { wall_time_s: 5, memory_kb: 51200 } },
  tests: [{ stdin: "", expected_stdout: "done" }],
});

const pyLoud = () => ({
  language: "py3",
  source: "import sys\nfor _ in range(200000): sys.stdout.write('A'*64)",
  run: { limits: { wall_time_s: 5 } },
  tests: [{ stdin: "", expected_stdout: "ignored" }],
});

export const loadSuite: Suite = {
  name: "load",
  description: "concurrency, queueing, latency under load; OOM and large-output behavior",
  async run(ctx) {
    if (ctx.readyz.py3 === false) {
      console.log(`${C.yellow}py3 not ready — skipping load suite${C.reset}`);
      return [{ name: "load: py3 not ready", ok: true, skipped: true }];
    }

    const concurrencies = ctx.concurrency > 0 ? [ctx.concurrency] : [1, 10, 50, 100];
    const perClient = Math.max(1, Math.floor((ctx.duration > 0 ? ctx.duration * 4 : 20) / 1));

    const out: Result[] = [];
    console.log(`${C.bold}load · py3 hello world${C.reset}`);
    for (const c of concurrencies) {
      const total = c * perClient;
      const s = await runScenario(ctx.base, `c=${c}`, c, total, pyHello);
      printScenario(s);
      const noFiveXX = s.http5xx === 0;
      const allAccepted = s.topAccepted === s.total;
      out.push({
        name: `load: hello c=${c}`,
        ok: noFiveXX && allAccepted,
        reason:
          !noFiveXX
            ? `${s.http5xx} 5xx — daemon dropped requests instead of queueing`
            : !allAccepted
              ? `only ${s.topAccepted}/${s.total} returned status=accepted`
              : undefined,
      });
    }

    // Latency floor sanity: with a 0.5s sleep, p50 must be >=500ms.
    console.log(`${C.bold}load · py3 sleep(0.5)${C.reset}`);
    {
      const s = await runScenario(ctx.base, `c=10`, 10, 20, pySleep);
      printScenario(s);
      const sorted = [...s.durationsMs].sort((a, b) => a - b);
      const p50 = quantile(sorted, 0.5);
      out.push({
        name: "load: sleep latency floor",
        ok: p50 >= 450 && s.http5xx === 0,
        reason: p50 < 450 ? `p50=${p50.toFixed(0)}ms below sleep floor` : undefined,
      });
    }

    // Memory limit: 50MiB cap, allocate 512MiB → expect memory_exceeded or runtime_error, no 5xx.
    console.log(`${C.bold}load · memory cap${C.reset}`);
    {
      const res = await send({ base: ctx.base, path: "/run", method: "POST", body: pyOom() });
      const okStatus =
        res.json?.status === "memory_exceeded" ||
        res.json?.status === "runtime_error";
      out.push({
        name: "load: OOM-attempt returns structured status (not 5xx)",
        ok: res.status === 200 && okStatus,
        reason:
          res.status !== 200
            ? `HTTP ${res.status}`
            : !okStatus
              ? `status=${res.json?.status}`
              : undefined,
      });
      console.log(`  status=${res.json?.status} http=${res.status}`);
    }

    // Output cap: write tons of bytes — expect a [truncated] marker somewhere in stdout.
    console.log(`${C.bold}load · output cap${C.reset}`);
    {
      const res = await send({ base: ctx.base, path: "/run", method: "POST", body: pyLoud() });
      const stdout: string = res.json?.tests?.[0]?.stdout ?? "";
      const truncated = /truncated/i.test(stdout);
      out.push({
        name: "load: large stdout truncated with marker",
        ok: res.status === 200 && truncated,
        reason: !truncated
          ? `no truncation marker, len=${stdout.length}`
          : undefined,
      });
      console.log(`  stdout.len=${stdout.length} truncated=${truncated}`);
    }

    // Summary.
    const pass = out.filter((r) => r.ok && !r.skipped).length;
    const fail = out.filter((r) => !r.ok).length;
    console.log(
      `\n${C.bold}load${C.reset}: ${C.green}${pass} passed${C.reset}, ` +
        `${fail ? C.red : C.dim}${fail} failed${C.reset}`,
    );
    return out;
  },
};
