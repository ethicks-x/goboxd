// @ts-nocheck
// Verilog suite: Icarus Verilog (iverilog → vvp) is a hardware-description
// language, not a general-purpose one. The sandbox exposes no /dev/stdin and
// runs with --disable_proc, so the stdin-driven corpus programs do not apply.
// These cases are self-contained simulations whose output is fixed at compile
// time, plus the build-failure path.

import { Case, Suite } from "../lib/types";
import { runCases, summarize } from "../lib/runner";

const LANG = "verilog";

const hello = `module main;
  initial $write("hi");
endmodule
`;

// Sum 1..10 = 55, computed in an initial block and written with no newline.
const sumLoop = `module main;
  integer i;
  integer s;
  initial begin
    s = 0;
    for (i = 1; i <= 10; i = i + 1) s = s + i;
    $write("%0d", s);
  end
endmodule
`;

const broken = `module main;
  initial begin
    this is not valid verilog
  end
endmodule
`;

const cases: Case[] = [
  {
    name: "verilog: hello world accepted",
    language: LANG,
    body: {
      language: LANG,
      source: hello,
      tests: [{ stdin: "", expected_stdout: "hi" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      buildStatus: "ok",
      testStatuses: ["accepted"],
      testStdouts: ["hi"],
    },
  },
  {
    name: "verilog: computed output (sum 1..10)",
    language: LANG,
    body: {
      language: LANG,
      source: sumLoop,
      tests: [{ stdin: "", expected_stdout: "55" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "accepted",
      buildStatus: "ok",
      testStatuses: ["accepted"],
      testStdouts: ["55"],
    },
  },
  {
    name: "verilog: wrong output detected",
    language: LANG,
    body: {
      language: LANG,
      source: hello,
      tests: [{ stdin: "", expected_stdout: "nope" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "wrong_output",
      testStatuses: ["wrong_output"],
    },
  },
  {
    name: "verilog: build failure → build_failed + not_executed",
    language: LANG,
    body: {
      language: LANG,
      source: broken,
      tests: [{ stdin: "", expected_stdout: "anything" }],
    },
    expect: {
      httpStatus: 200,
      topStatus: "internal_error",
      buildStatus: "internal_error",
      testStatuses: ["not_executed"],
    },
  },
];

export const verilogSuite: Suite = {
  name: "verilog",
  description: "Icarus Verilog: hello, computed output, wrong output, build failure",
  async run(ctx) {
    const r = await runCases(cases, ctx);
    console.log("");
    summarize("verilog", r);
    return r;
  },
};
