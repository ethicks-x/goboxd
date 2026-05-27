# goboxd — Progress

> Update this file as tasks complete. Check off each item the moment it is done, not in batches.

---

## Stage 1 — Prototype

### Foundation

- [x] `internal/config/config.go` — Config struct, Load(), env overrides (GOBOXD_*)
- [x] `configs/config.yaml` — default server config (port, jail dir, max_concurrent, limits)

### Language registry

- [x] `internal/registry/language.go` — Language struct (id, name, build, run, smoke_cmd, limits)
- [x] `internal/registry/template.go` — Expand(args, vars): {{source}}, {{artifact}}, {{flags}}
- [x] `internal/registry/registry.go` — Load YAML, startup validation, Lookup(id), All()
- [x] `configs/languages.yaml` — py3 and cpp entries

### Validation

- [x] `internal/validation/filename.go` — reject path separators, `..`, leading dot, length cap
- [x] `internal/validation/flags.go` — per-language allowlist, glob match for `-std=*`, return 400 on reject
- [x] `internal/validation/limits.go` — MergeLimits(request overrides, language defaults)

### Sandbox

- [x] `internal/sandbox/sandbox.go` — Sandbox interface, BuildJob, RunJob, BuildResult, TestResult types
- [x] `internal/sandbox/nsjail/nsjail.go` — NsjailSandbox: argv builder, os/exec run, output cap with [truncated] marker
- [x] `internal/sandbox/mock/mock.go` — MockSandbox: host exec, no isolation (tests only)

### Runner

- [x] `internal/runner/concurrency.go` — Semaphore via chan struct{}, Acquire blocks (never rejects)
- [x] `internal/runner/workdir.go` — SafeWorkDir (os.MkdirTemp + defer Remove), StartupSweep (orphans > 10 min)
- [x] `internal/runner/pipeline.go` — build step → per-test run steps → status roll-up logic
- [x] `internal/runner/runner.go` — Runner struct, Run(ctx, RunRequest) RunResponse, wires all above

### Stats

- [x] `internal/stats/stats.go` — atomic counters: InFlight, JobsTotal, JobsFailedInternal, LastErrorAt, DiskFree

### Handlers

- [x] `internal/handlers/health.go` — GET /healthz → 200 {"status":"ok"}
- [x] `internal/handlers/readyz.go` — GET /readyz → nsjail binary check + per-lang smoke probe, 30s cache
- [x] `internal/handlers/info.go` — GET /info → build_info, nsjail version, languages, limits, stats
- [x] `internal/handlers/run.go` — POST /run: MaxBytesReader, decode, validate, runner.Run, encode

### Wiring

- [ ] `cmd/goboxd/main.go` — wire config → registry → sandbox → runner → handlers → server

### Dockerfile

- [ ] Fix `cmd/goboxd` build path (currently broken per CLAUDE.md)
- [ ] Install py3 and g++ in runtime stage
- [ ] Verify `make build` and `make run` succeed

### Tests

- [ ] `tests/unit/filename_test.go` — table-driven: traversal, dot-prefix, absolute paths
- [ ] `tests/unit/flags_test.go` — allowlist pass/reject, glob `-std=*`
- [ ] `tests/unit/limits_test.go` — merge override logic, zero-value fallback
- [ ] `tests/unit/status_test.go` — roll-up: build_failed, first non-accepted, all accepted
- [ ] `tests/unit/truncation_test.go` — output cap, [truncated] marker present
- [ ] `tests/integration/run_test.go` — end-to-end: py3 hello world, cpp hello world (build tag: integration)

### Documentation (Stage 1 minimum)

- [ ] `README.md` — what it is, how to run, where the docs are; no filler
- [ ] `docs/api.md` — full API contract with request/response examples
- [ ] `docs/security.md` — 7 holes listed, each with file:line where it is closed

---

## Stage 2 — Polyglot

> No Go code changes. YAML edits and Dockerfile installs only.

- [ ] `configs/languages.yaml` — add: c, java, bash, node, verilog
- [ ] `Dockerfile` — install: gcc, openjdk, bash (already present), nodejs, iverilog
- [ ] Smoke-test each new language via `/readyz`
- [ ] `tests/integration/run_test.go` — add one test per new language
- [ ] `docs/languages.md` — per-language notes: filename rules, flag allowlist, limits

---

## Stage 3 — Harden and Load

> No Go code changes. Verification and documentation only.

- [ ] Verify all 7 security holes are closed (they should be from Stage 1)
- [ ] Run load tests at 1, 10, 50, 100 concurrent clients (hey or vegeta)
- [ ] `docs/benchmarks.md` — p50, p95, p99 results from a clean Docker run
- [ ] `Makefile` — wire `make load` target
- [ ] `docs/architecture.md` — enough detail that a new engineer can orient on day one

---

## Notes

- `5xx` is only for server failures. User-code crashes, timeouts, OOMs all return `200` with structured status.
- Adding a language in Stage 2 must take under 30 minutes: one YAML block + one Dockerfile install line.
- Security holes are implemented in Stage 1 so Stage 3 is verification, not new work.
- Concurrency pool is always on; `max_concurrent` defaults to `runtime.NumCPU()`.
