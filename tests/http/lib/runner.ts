// @ts-nocheck
// Generic case runner + reporter. Used by unit/integration/corpus/security suites.

import { Case, Expect, Result, SuiteContext } from "./types";
import { send } from "./client";
import { C } from "./colors";

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

export function checkExpect(e: Expect, status: number, body: any, res?: Response): string | null {
  if (e.httpStatus !== undefined && status !== e.httpStatus) {
    return `expected HTTP ${e.httpStatus}, got ${status}`;
  }
  if (e.bodyJsonHas) {
    const err = shallowHas(body, e.bodyJsonHas);
    if (err) return err;
  }
  if (e.errorCode && body?.error?.code !== e.errorCode) {
    return `error.code expected ${e.errorCode}, got ${body?.error?.code}`;
  }
  if (e.topStatus !== undefined && body?.status !== e.topStatus) {
    return `top status expected ${e.topStatus}, got ${body?.status}`;
  }
  if (e.buildStatus !== undefined && body?.build?.status !== e.buildStatus) {
    return `build.status expected ${e.buildStatus}, got ${body?.build?.status}`;
  }
  if (e.testStatuses) {
    const got = (body?.tests ?? []).map((t: any) => t?.status);
    if (JSON.stringify(got) !== JSON.stringify(e.testStatuses)) {
      return `tests[].status expected ${JSON.stringify(e.testStatuses)}, got ${JSON.stringify(got)}`;
    }
  }
  if (e.testStdouts) {
    const tests = body?.tests ?? [];
    for (let i = 0; i < e.testStdouts.length; i++) {
      if (!matchStdout(tests[i]?.stdout ?? "", e.testStdouts[i])) {
        return `tests[${i}].stdout mismatch (got ${JSON.stringify(tests[i]?.stdout)})`;
      }
    }
  }
  if (e.custom) {
    const r = e.custom(body, res as any);
    if (r) return r;
  }
  return null;
}

export async function runCase(c: Case, ctx: SuiteContext): Promise<Result> {
  const lang = c.language ?? (c.body as any)?.language;
  if (lang && Object.keys(ctx.readyz).length && ctx.readyz[lang] === false) {
    return { name: c.name, ok: true, skipped: true, reason: `${lang} not ready` };
  }
  if (ctx.langFilter && lang && lang !== ctx.langFilter) {
    return { name: c.name, ok: true, skipped: true, reason: `lang filter` };
  }

  const start = performance.now();
  let resp;
  try {
    resp = await send({
      base: ctx.base,
      path: c.path ?? "/run",
      method: c.method ?? "POST",
      body: c.body,
      rawBody: c.rawBody,
      headers: c.headers,
    });
  } catch (e: any) {
    return { name: c.name, ok: false, reason: `fetch failed: ${e.message}` };
  }
  const durationMs = performance.now() - start;

  const reason = checkExpect(c.expect, resp.status, resp.json, { status: resp.status } as any);
  if (reason) {
    const extra = ctx.verbose ? `\n  ${C.dim}body: ${resp.text.slice(0, 400)}${C.reset}` : "";
    return { name: c.name, ok: false, reason: reason + extra, durationMs };
  }
  return { name: c.name, ok: true, durationMs };
}

export async function runCases(cases: Case[], ctx: SuiteContext): Promise<Result[]> {
  const filtered = ctx.only
    ? cases.filter((c) => c.name.toLowerCase().includes(ctx.only!.toLowerCase()))
    : cases;

  const results: Result[] = [];
  for (const c of filtered) {
    process.stdout.write(`${C.dim}…${C.reset} ${c.name}`);
    const r = await runCase(c, ctx);
    results.push(r);
    const tag = r.skipped
      ? `${C.yellow}SKIP${C.reset}`
      : r.ok
        ? `${C.green}PASS${C.reset}`
        : `${C.red}FAIL${C.reset}`;
    const dur = r.durationMs ? ` ${C.dim}(${r.durationMs.toFixed(0)}ms)${C.reset}` : "";
    process.stdout.write(`\r${tag} ${c.name}${dur}`);
    if (r.reason && !r.skipped) process.stdout.write(`  ${C.dim}— ${r.reason}${C.reset}`);
    else if (r.reason && r.skipped) process.stdout.write(`  ${C.dim}(${r.reason})${C.reset}`);
    process.stdout.write("\n");
  }
  return results;
}

export function summarize(label: string, results: Result[]): { pass: number; fail: number; skip: number } {
  const pass = results.filter((r) => r.ok && !r.skipped).length;
  const skip = results.filter((r) => r.skipped).length;
  const fail = results.filter((r) => !r.ok).length;
  console.log(
    `${C.bold}${label}${C.reset}: ${C.green}${pass} passed${C.reset}, ` +
      `${C.yellow}${skip} skipped${C.reset}, ${fail ? C.red : C.dim}${fail} failed${C.reset}`,
  );
  return { pass, fail, skip };
}
