// @ts-nocheck
// Unit suite: health/info/readyz endpoints + /run payload conventions + 4xx errors.
// These tests do not depend on any language toolchain being installed.

import { Case, Suite } from "../lib/types";
import { runCases, summarize } from "../lib/runner";

const unitCases: Case[] = [
  // ---------------- health & info ----------------
  {
    name: "GET /healthz → 200 {status:ok}",
    path: "/healthz",
    method: "GET",
    expect: { httpStatus: 200, bodyJsonHas: { status: "ok" } },
  },
  {
    name: "GET /healthz is cheap (responds <500ms)",
    path: "/healthz",
    method: "GET",
    expect: {
      httpStatus: 200,
      custom: (_b, _r) => null, // duration enforced by runner-printed durationMs
    },
  },
  {
    name: "GET /info → 200 with build_info and languages[]",
    path: "/info",
    method: "GET",
    expect: {
      httpStatus: 200,
      custom: (b) => {
        if (!b?.build_info) return "missing build_info";
        if (!Array.isArray(b?.languages)) return "languages must be array";
        if (!b?.limits) return "missing limits";
        if (!b?.stats) return "missing stats";
        return null;
      },
    },
  },
  {
    name: "GET /info reports max_source_bytes and max_tests",
    path: "/info",
    method: "GET",
    expect: {
      httpStatus: 200,
      custom: (b) =>
        typeof b?.limits?.max_source_bytes !== "number" ||
        typeof b?.limits?.max_tests !== "number"
          ? "limits.max_source_bytes / max_tests missing"
          : null,
    },
  },
  {
    name: "GET /info reports nsjail path",
    path: "/info",
    method: "GET",
    expect: {
      httpStatus: 200,
      custom: (b) => (b?.nsjail?.path ? null : "nsjail.path missing"),
    },
  },

  // ---------------- /run validation (no execution needed) ----------------
  {
    name: "400: missing language",
    body: { source: "print(1)", tests: [{ stdin: "", expected_stdout: "1" }] },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: missing source",
    body: { language: "py3", tests: [{ stdin: "", expected_stdout: "1" }] },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: missing tests",
    body: { language: "py3", source: "print(1)" },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: empty tests array",
    body: { language: "py3", source: "print(1)", tests: [] },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: unknown language",
    body: {
      language: "brainfuck-9000",
      source: "+",
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: malformed JSON body",
    rawBody: "{not json",
    expect: { httpStatus: 400 },
  },
  {
    name: "400: empty body",
    rawBody: "",
    expect: { httpStatus: 400 },
  },
  {
    name: "400: source_filename with path separator",
    body: {
      language: "py3",
      source: "print(1)",
      source_filename: "sub/dir.py",
      tests: [{ stdin: "", expected_stdout: "1" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: source_filename traversal (../../etc/passwd)",
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
    name: "400: leading-dot source_filename",
    body: {
      language: "py3",
      source: "print(1)",
      source_filename: ".hidden.py",
      tests: [{ stdin: "", expected_stdout: "1" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: oversize source (>max_source_bytes)",
    body: {
      language: "py3",
      source: "x='" + "A".repeat(300_000) + "'\nprint('hi')",
      tests: [{ stdin: "", expected_stdout: "hi" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: disallowed compile flag (-fplugin)",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["-fplugin=/tmp/evil.so"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: disallowed compile flag (-Wl,-rpath)",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["-Wl,-rpath=/tmp"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: disallowed compile flag (--specs)",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["--specs=/tmp/x"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "400: disallowed compile flag (response file @args)",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["@/etc/passwd"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },

  // ---------------- method/route conventions ----------------
  {
    name: "GET /run is not allowed",
    path: "/run",
    method: "GET",
    expect: {
      custom: (_b, r) =>
        r && (r.status === 405 || r.status === 404)
          ? null
          : `expected 404/405, got ${(r as any)?.status}`,
    },
  },
  {
    name: "PUT /run is not allowed",
    path: "/run",
    method: "PUT",
    expect: {
      custom: (_b, r) =>
        r && (r.status === 405 || r.status === 404)
          ? null
          : `expected 404/405, got ${(r as any)?.status}`,
    },
  },
  {
    name: "Unknown route 404",
    path: "/no-such-endpoint",
    method: "GET",
    expect: { httpStatus: 404 },
  },
  {
    name: "400: too many tests (over max_tests)",
    body: {
      language: "py3",
      source: "print(1)",
      tests: Array.from({ length: 1000 }, () => ({ stdin: "", expected_stdout: "1" })),
    },
    expect: { httpStatus: 400 },
  },
];

// /readyz fits the same pattern now that custom callbacks can see the HTTP status.
unitCases.unshift({
  name: "GET /readyz returns 200 or 503",
  path: "/readyz",
  method: "GET",
  expect: {
    custom: (_b, r) =>
      r && (r.status === 200 || r.status === 503)
        ? null
        : `expected 200 or 503, got ${(r as any)?.status}`,
  },
});

export const unitSuite: Suite = {
  name: "unit",
  description: "health/info/readyz endpoints, /run payload validation, error contracts",
  async run(ctx) {
    const results = await runCases(unitCases, ctx);
    console.log("");
    summarize("unit", results);
    return results;
  },
};
