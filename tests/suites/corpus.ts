// @ts-nocheck
// Corpus suite: every PROGRAMS × LANGS combination as accepted runs.
// Mostly counting/string work; case count is programs × languages.

import { Case, Suite } from "../lib/types";
import { runCases, summarize } from "../lib/runner";
import { PROGRAMS, LANGS } from "../lib/sources";

const cases: Case[] = [];
for (const p of PROGRAMS) {
  for (const lang of LANGS) {
    const src = p.by[lang];
    cases.push({
      name: `corpus/${p.id}/${lang}`,
      language: lang,
      body: { ...src, tests: p.cases },
      expect: {
        httpStatus: 200,
        topStatus: "accepted",
        testStatuses: p.cases.map(() => "accepted"),
      },
    });
  }
}

export const corpusSuite: Suite = {
  name: "corpus",
  description: `${cases.length}-case correctness corpus, spread across ${LANGS.length} languages`,
  async run(ctx) {
    const r = await runCases(cases, ctx);
    console.log("");
    summarize("corpus", r);
    return r;
  },
};
