// @ts-nocheck
// Security suite: drive each of the seven holes from docs/goboxd.spec.md.
// Each case asserts the daemon either rejects the request at the HTTP layer (400)
// or contains the resulting damage inside the sandbox (no host-side compromise).

import { Case, Suite } from "../lib/types";
import { runCases, summarize } from "../lib/runner";

const cases: Case[] = [
  // ---------- Hole 1: path traversal via filename ----------
  {
    name: "sec/traversal: source_filename '../../etc/passwd' rejected",
    body: {
      language: "py3",
      source: "print(1)",
      source_filename: "../../etc/passwd",
      tests: [{ stdin: "", expected_stdout: "1" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/traversal: source_filename with backslash rejected",
    body: {
      language: "py3",
      source: "print(1)",
      source_filename: "..\\foo.py",
      tests: [{ stdin: "", expected_stdout: "1" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/traversal: source_filename leading dot rejected",
    body: {
      language: "py3",
      source: "print(1)",
      source_filename: ".bashrc",
      tests: [{ stdin: "", expected_stdout: "1" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/traversal: artifact_filename traversal rejected",
    body: {
      language: "cpp",
      source: "int main(){return 0;}",
      artifact_filename: "../escape",
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },

  // ---------- Hole 3: compiler flag injection ----------
  {
    name: "sec/flags: -fplugin rejected",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["-fplugin=/tmp/evil.so"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/flags: -x c rejected (language override)",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["-x", "c"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/flags: -B/lib rejected",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["-B/lib"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/flags: --specs rejected",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["--specs=/tmp/x"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/flags: -Wl,... rejected",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["-Wl,-rpath=/etc"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/flags: response file @path rejected",
    body: {
      language: "cpp",
      source: "int main(){}",
      build: { flags: ["@/etc/passwd"] },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/flags: -O2 allowed (sanity, positive case)",
    language: "cpp",
    body: {
      language: "cpp",
      source: '#include <iostream>\nint main(){std::cout<<"hi";return 0;}',
      build: { flags: ["-O2"] },
      tests: [{ stdin: "", expected_stdout: "hi" }],
    },
    expect: { httpStatus: 200, topStatus: "accepted" },
  },

  // ---------- Hole 4: request size limits ----------
  {
    name: "sec/size: source over cap rejected",
    body: {
      language: "py3",
      source: "x='" + "A".repeat(500_000) + "'\nprint(1)",
      tests: [{ stdin: "", expected_stdout: "1" }],
    },
    expect: { httpStatus: 400 },
  },
  {
    name: "sec/size: tests array way over cap rejected",
    body: {
      language: "py3",
      source: "print(1)",
      tests: Array.from({ length: 5000 }, () => ({ stdin: "", expected_stdout: "1" })),
    },
    expect: { httpStatus: 400 },
  },

  // ---------- Hole 6: unbounded child output ----------
  {
    name: "sec/output: huge stdout is truncated, not 5xx",
    language: "py3",
    body: {
      language: "py3",
      source: "import sys\nfor _ in range(200000): sys.stdout.write('A'*64)",
      run: { limits: { wall_time_s: 5 } },
      tests: [{ stdin: "", expected_stdout: "ignored" }],
    },
    expect: {
      httpStatus: 200,
      custom: (b) => {
        const s: string = b?.tests?.[0]?.stdout ?? "";
        if (!/truncated/i.test(s)) return `no [truncated] marker, len=${s.length}`;
        if (s.length > 4 * 1024 * 1024) return `stdout not capped (len=${s.length})`;
        return null;
      },
    },
  },

  // ---------- Sandbox containment (network, fs, fork bomb) ----------
  {
    name: "sec/sandbox: no network — DNS / socket access blocked",
    language: "py3",
    body: {
      language: "py3",
      source:
        "import socket\ntry:\n  socket.create_connection(('1.1.1.1',53),timeout=1);print('LEAK',end='')\nexcept Exception as e:\n  print('blocked',end='')\n",
      run: { limits: { wall_time_s: 4 } },
      tests: [{ stdin: "", expected_stdout: "blocked" }],
    },
    expect: { httpStatus: 200, topStatus: "accepted" },
  },
  {
    name: "sec/sandbox: cannot read /etc/shadow",
    language: "py3",
    body: {
      language: "py3",
      source:
        "import os\ntry:\n  open('/etc/shadow').read();print('LEAK',end='')\nexcept Exception:\n  print('blocked',end='')\n",
      tests: [{ stdin: "", expected_stdout: "blocked" }],
    },
    expect: { httpStatus: 200, topStatus: "accepted" },
  },
  {
    name: "sec/sandbox: cannot write outside jail dir",
    language: "py3",
    body: {
      language: "py3",
      source:
        "try:\n  open('/etc/pwned','w').write('x');print('LEAK',end='')\nexcept Exception:\n  print('blocked',end='')\n",
      tests: [{ stdin: "", expected_stdout: "blocked" }],
    },
    expect: { httpStatus: 200, topStatus: "accepted" },
  },
  {
    name: "sec/sandbox: fork bomb contained (process cap or time_exceeded)",
    language: "py3",
    body: {
      language: "py3",
      source:
        "import os\ntry:\n  while True: os.fork()\nexcept Exception:\n  pass\n",
      run: { limits: { wall_time_s: 2, max_processes: 16 } },
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: {
      httpStatus: 200,
      custom: (b) => {
        const s = b?.status;
        return s === "time_exceeded" || s === "runtime_error" || s === "accepted"
          ? null
          : `unexpected status ${s}`;
      },
    },
  },
  {
    name: "sec/sandbox: cannot list host root contents (jail isolation)",
    language: "py3",
    body: {
      language: "py3",
      source:
        "import os\ntry:\n  e=os.listdir('/');print('home' in e,end='')\nexcept Exception:\n  print('blocked',end='')\n",
      tests: [
        // Either the listing fails ('blocked'), or it succeeds but does not see the host's /home.
        { stdin: "", expected_stdout: "False" },
      ],
    },
    expect: {
      httpStatus: 200,
      custom: (b) => {
        const out = b?.tests?.[0]?.stdout ?? "";
        return out === "False" || out === "blocked"
          ? null
          : `unexpected listing: ${JSON.stringify(out)}`;
      },
    },
  },

  // ---------- Server crash resilience ----------
  {
    name: "sec/no-5xx-on-user-crash: divide by zero",
    language: "py3",
    body: {
      language: "py3",
      source: "x=1/0",
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: { httpStatus: 200, topStatus: "runtime_error" },
  },
  {
    name: "sec/no-5xx-on-user-crash: segfault (cpp)",
    language: "cpp",
    body: {
      language: "cpp",
      source: "int main(){int*p=0;*p=42;return 0;}",
      tests: [{ stdin: "", expected_stdout: "" }],
    },
    expect: {
      httpStatus: 200,
      custom: (b) =>
        b?.status === "runtime_error" || b?.status === "memory_exceeded"
          ? null
          : `expected runtime_error, got ${b?.status}`,
    },
  },
];

export const securitySuite: Suite = {
  name: "security",
  description: "the seven holes from docs/goboxd.spec.md + sandbox containment checks",
  async run(ctx) {
    const r = await runCases(cases, ctx);
    summarize("security", r);
    return r;
  },
};
