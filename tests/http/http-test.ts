#!/usr/bin/env bun
// @ts-nocheck
// goboxd HTTP test CLI.
//
//   bun tests/http/http-test.ts <suite> [options]
//
// Suites:
//   unit          health/info/readyz endpoints, /run payload validation, error contracts
//   integration   end-to-end per-language: happy path, echo, wrong output, build fail, runtime, timeout
//   corpus        40-case correctness corpus across all languages
//   load          concurrency, queue, latency, OOM, output cap
//   security      the 7 holes from docs/goboxd.spec.md + sandbox containment
//   all           runs every suite in order
//
// Options:
//   --base-url=<url>      default $BASE_URL or http://localhost:8080
//   --only=<substring>    filter case names (case-insensitive)
//   --lang=<id>           restrict to one language (skip cases targeting others)
//   --concurrency=<n>     load: override client concurrency (default sweeps 1/10/50/100)
//   --duration=<seconds>  load: roughly tune total request count per scenario
//   --verbose             on failure, print first 400 chars of the response body
//   --json                machine-readable summary at the end
//   --list                list available suites and exit
//   --help, -h            show this help

import { Suite, SuiteContext, Result } from "./lib/types";
import { reachable, readyzLanguages } from "./lib/client";
import { C } from "./lib/colors";
import { unitSuite } from "./suites/unit";
import { integrationSuite } from "./suites/integration";
import { corpusSuite } from "./suites/corpus";
import { loadSuite } from "./suites/load";
import { securitySuite } from "./suites/security";

const SUITES: Record<string, Suite> = {
  unit: unitSuite,
  integration: integrationSuite,
  corpus: corpusSuite,
  load: loadSuite,
  security: securitySuite,
};
const ORDER = ["unit", "integration", "corpus", "security", "load"];

function help() {
  const lines = [
    `${C.bold}goboxd http-test${C.reset}  ${C.dim}— HTTP-driven test CLI${C.reset}`,
    ``,
    `Usage:  bun tests/http/http-test.ts <suite> [options]`,
    ``,
    `Suites:`,
    ...Object.entries(SUITES).map(([k, s]) => `  ${k.padEnd(13)} ${C.dim}${s.description}${C.reset}`),
    `  all           ${C.dim}runs every suite in order${C.reset}`,
    ``,
    `Options:`,
    `  --base-url=<url>      default $BASE_URL or http://localhost:8080`,
    `  --only=<substring>    filter case names (case-insensitive)`,
    `  --lang=<id>           restrict to a single language id`,
    `  --concurrency=<n>     load: override client concurrency`,
    `  --duration=<seconds>  load: roughly tune total requests per scenario`,
    `  --verbose             on failure, print 400 chars of response body`,
    `  --json                emit a JSON summary at the end`,
    `  --list                list suites and exit`,
    `  --help, -h            show this help`,
    ``,
    `Examples:`,
    `  bun tests/http/http-test.ts unit`,
    `  bun tests/http/http-test.ts corpus --lang=py3`,
    `  bun tests/http/http-test.ts load --concurrency=20 --duration=10`,
    `  BASE_URL=http://localhost:8080 bun tests/http/http-test.ts all`,
  ];
  console.log(lines.join("\n"));
}

function parseArgs(argv: string[]): { suite: string; ctx: Partial<SuiteContext>; jsonOut: boolean; list: boolean } {
  const out: any = { suite: "", ctx: {}, jsonOut: false, list: false };
  for (const a of argv) {
    if (a === "--help" || a === "-h") {
      help();
      process.exit(0);
    } else if (a === "--list") {
      out.list = true;
    } else if (a === "--verbose") {
      out.ctx.verbose = true;
    } else if (a === "--json") {
      out.jsonOut = true;
    } else if (a.startsWith("--base-url=")) {
      out.ctx.base = a.slice(11);
    } else if (a.startsWith("--only=")) {
      out.ctx.only = a.slice(7);
    } else if (a.startsWith("--lang=")) {
      out.ctx.langFilter = a.slice(7);
    } else if (a.startsWith("--concurrency=")) {
      out.ctx.concurrency = parseInt(a.slice(14), 10);
    } else if (a.startsWith("--duration=")) {
      out.ctx.duration = parseInt(a.slice(11), 10);
    } else if (!a.startsWith("--") && !out.suite) {
      out.suite = a;
    } else {
      console.error(`${C.red}unknown argument: ${a}${C.reset}`);
      process.exit(2);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.list) {
    for (const k of Object.keys(SUITES)) console.log(k);
    console.log("all");
    process.exit(0);
  }

  if (!args.suite) {
    help();
    process.exit(2);
  }

  const base = args.ctx.base ?? process.env.BASE_URL ?? "http://localhost:8080";
  const ctx: SuiteContext = {
    base,
    readyz: {},
    only: args.ctx.only,
    langFilter: args.ctx.langFilter,
    verbose: !!args.ctx.verbose,
    concurrency: args.ctx.concurrency ?? 0,
    duration: args.ctx.duration ?? 0,
    jsonOut: args.jsonOut,
  };

  console.log(
    `${C.bold}goboxd http-test${C.reset}  ${C.dim}→ ${ctx.base}  suite=${args.suite}${C.reset}`,
  );

  if (!(await reachable(ctx.base))) {
    console.error(`${C.red}cannot reach ${ctx.base} — is the server running?${C.reset}`);
    process.exit(2);
  }

  ctx.readyz = await readyzLanguages(ctx.base);
  if (Object.keys(ctx.readyz).length) {
    const summary = Object.entries(ctx.readyz)
      .map(([k, v]) => `${k}=${v ? C.green + "ok" + C.reset : C.yellow + "down" + C.reset}`)
      .join(" ");
    console.log(`${C.dim}readyz:${C.reset} ${summary}`);
  }
  console.log("");

  const suiteList: Suite[] =
    args.suite === "all"
      ? ORDER.map((k) => SUITES[k])
      : SUITES[args.suite]
        ? [SUITES[args.suite]]
        : [];
  if (suiteList.length === 0) {
    console.error(`${C.red}unknown suite: ${args.suite}${C.reset}`);
    console.error(`available: ${Object.keys(SUITES).join(", ")}, all`);
    process.exit(2);
  }

  const perSuite: Record<string, Result[]> = {};
  for (const s of suiteList) {
    console.log(`${C.bold}${C.cyan}── ${s.name} ──${C.reset}  ${C.dim}${s.description}${C.reset}`);
    perSuite[s.name] = await s.run(ctx);
    // console.log("");
  }

  // Aggregate.
  let pass = 0,
    fail = 0,
    skip = 0;
  for (const list of Object.values(perSuite)) {
    for (const r of list) {
      if (r.skipped) skip++;
      else if (r.ok) pass++;
      else fail++;
    }
  }
  console.log(
    `${C.bold}total${C.reset}: ${C.green}${pass} passed${C.reset}, ` +
      `${C.yellow}${skip} skipped${C.reset}, ${fail ? C.red : C.dim}${fail} failed${C.reset}`,
  );

  if (args.jsonOut) {
    const summary = {
      base: ctx.base,
      pass,
      fail,
      skip,
      suites: Object.fromEntries(
        Object.entries(perSuite).map(([k, rs]) => [
          k,
          {
            total: rs.length,
            pass: rs.filter((r) => r.ok && !r.skipped).length,
            fail: rs.filter((r) => !r.ok).length,
            skip: rs.filter((r) => r.skipped).length,
            failures: rs.filter((r) => !r.ok).map((r) => ({ name: r.name, reason: r.reason })),
          },
        ]),
      ),
    };
    console.log("\n" + JSON.stringify(summary, null, 2));
  }

  process.exit(fail ? 1 : 0);
}

main();
