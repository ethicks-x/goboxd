// @ts-nocheck
// Integration suite: one hello-world + one stdin-echo + a build-failure for each language.
// Skips silently for any language that /readyz reports as down.

import { Case, Suite } from "../lib/types";
import { runCases, summarize } from "../lib/runner";
import { PROGRAMS, LANGS, Lang } from "../lib/sources";

function helloCase(lang: Lang): Case {
  const p = PROGRAMS.find((x) => x.id === "hello")!;
  const src = p.by[lang];
  return {
    name: `${lang}: hello world accepted`,
    language: lang,
    body: {
      ...src,
      tests: p.cases,
    },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      testStatuses: p.cases.map(() => "accepted"),
    },
  };
}

function echoCase(lang: Lang): Case {
  const p = PROGRAMS.find((x) => x.id === "echo-upper")!;
  const src = p.by[lang];
  return {
    name: `${lang}: echo stdin uppercased`,
    language: lang,
    body: { ...src, tests: p.cases },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      testStatuses: p.cases.map(() => "accepted"),
    },
  };
}

function wrongOutputCase(lang: Lang): Case {
  const p = PROGRAMS.find((x) => x.id === "hello")!;
  const src = p.by[lang];
  return {
    name: `${lang}: wrong output detected`,
    language: lang,
    body: {
      ...src,
      tests: [{ stdin: "", expected_stdout: "nope" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "wrong_output",
      testStatuses: ["wrong_output"],
    },
  };
}

function buildFailureCase(lang: Lang): Case | null {
  // Only meaningful for compiled languages.
  const broken: Partial<Record<Lang, { source: string; source_filename?: string; artifact_filename?: string }>> = {
    cpp: { source: "this is not valid c++ ;" },
    c: { source: "this is not valid c ;" },
    java: {
      source: "public class Solution { not valid java }",
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    go: {
      source: "package main\nthis is not valid go",
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      source: "fn main() { this is not valid rust }",
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  };
  const b = broken[lang];
  if (!b) return null;
  return {
    name: `${lang}: build failure → build_failed + not_executed`,
    language: lang,
    body: {
      language: lang,
      ...b,
      tests: [{ stdin: "", expected_stdout: "anything" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "build_failed",
      buildStatus: "failed",
      testStatuses: ["not_executed"],
    },
  };
}

function runtimeErrorCase(lang: Lang): Case | null {
  const crash: Partial<Record<Lang, { source: string; source_filename?: string; artifact_filename?: string }>> = {
    py3: { source: "raise SystemExit(1)" },
    js: { source: "process.exit(1)" },
    bash: { source: "exit 1" },
    cpp: {
      source: "#include <cstdlib>\nint main(){return 1;}",
    },
    c: { source: "int main(){return 1;}" },
    java: {
      source:
        'public class Solution{public static void main(String[]a){System.exit(1);}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    go: {
      source: 'package main\nimport "os"\nfunc main(){os.Exit(1)}',
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      source: "fn main(){std::process::exit(1);}",
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  };
  const s = crash[lang];
  if (!s) return null;
  return {
    name: `${lang}: nonzero exit → runtime_error`,
    language: lang,
    body: {
      language: lang,
      ...s,
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "runtime_error",
      testStatuses: ["runtime_error"],
    },
  };
}

function timeExceededCase(lang: Lang): Case | null {
  const inf: Partial<Record<Lang, { source: string; source_filename?: string; artifact_filename?: string }>> = {
    py3: { source: "while True: pass" },
    js: { source: "while(true){}" },
    bash: { source: "while true; do :; done" },
    cpp: { source: "int main(){while(1){}return 0;}" },
    c: { source: "int main(){while(1){}return 0;}" },
    java: {
      source:
        'public class Solution{public static void main(String[]a){while(true){}}}',
      source_filename: "Solution.java",
      artifact_filename: "Solution",
    },
    go: {
      source: "package main\nfunc main(){for{}}",
      source_filename: "solution.go",
      artifact_filename: "solution",
    },
    rust: {
      source: "fn main(){loop{}}",
      source_filename: "solution.rs",
      artifact_filename: "solution",
    },
  };
  const s = inf[lang];
  if (!s) return null;
  return {
    name: `${lang}: infinite loop → time_exceeded`,
    language: lang,
    body: {
      language: lang,
      ...s,
      run: { limits: { wall_time_s: 1 } },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "time_exceeded",
      testStatuses: ["time_exceeded"],
    },
  };
}

const cases: Case[] = LANGS.flatMap((l) => {
  const list: (Case | null)[] = [
    helloCase(l),
    echoCase(l),
    wrongOutputCase(l),
    buildFailureCase(l),
    runtimeErrorCase(l),
    timeExceededCase(l),
  ];
  return list.filter((x): x is Case => x !== null);
});

export const integrationSuite: Suite = {
  name: "integration",
  description: "end-to-end run per language: happy path, echo, wrong output, build failure, runtime, timeout",
  async run(ctx) {
    const r = await runCases(cases, ctx);
    console.log("");
    summarize("integration", r);
    return r;
  },
};
