# goboxd — Implementation Plan

## Core principle

Every capability required across all three stages is implemented in Go once. Stages differ only by what lives in YAML config files and Dockerfile install steps — no Go code change required to advance between stages.

---

## Package structure

```
cmd/goboxd/main.go              # wire config → registry → runner → handlers

configs/
  config.yaml                  # server settings (max_concurrent, limits, paths)
  languages.yaml               # language registry (add entries here to advance stages)

internal/
  config/
    config.go                  # Load() → Config struct; env overrides (GOBOXD_*)

  registry/
    registry.go                # Load YAML, validate, Lookup(id), All()
    language.go                # Language struct: id, build{cmd,args,limits,allowlist}, run{...}
    template.go                # Expand {{source}}, {{artifact}}, {{flags}} in arg arrays

  validation/
    filename.go                # ValidateFilename(): single component, no dot-prefix, no separator
    flags.go                   # FilterFlags(requested, allowlist): glob match (-std=*), 400 on reject
    limits.go                  # MergeLimits(request, langDefaults) → effective Limits

  sandbox/
    sandbox.go                 # interface Sandbox + types Job, BuildResult, TestResult
    nsjail/
      nsjail.go                # NsjailSandbox: builds nsjail argv, runs os/exec, caps output
    mock/
      mock.go                  # MockSandbox: runs on host via exec, no isolation (unit tests only)

  runner/
    runner.go                  # Runner.Run(ctx, RunRequest) → RunResponse
    workdir.go                 # SafeWorkDir(): os.MkdirTemp + deferred Remove; StartupSweep()
    pipeline.go                # build step → per-test run steps → status roll-up
    concurrency.go             # Semaphore: chan struct{} sized MaxConcurrent; blocks, doesn't reject

  stats/
    stats.go                   # atomic: InFlight, JobsTotal, JobsFailedInternal, LastErrorAt, DiskFree

  handlers/
    run.go                     # POST /run: decode → validate → runner.Run → encode
    health.go                  # GET /healthz: 200 {"status":"ok"}
    readyz.go                  # GET /readyz: nsjail binary + per-lang smoke probe
    info.go                    # GET /info: build_info, nsjail, languages, limits, stats

  server/                      # existing (keep as-is)

tests/
  unit/
    filename_test.go           # table-driven: traversal, dot-prefix, separators
    flags_test.go              # allowlist filtering, glob (-std=*)
    limits_test.go             # merge override logic
    status_test.go             # roll-up rules: build_failed, first non-accepted
    truncation_test.go         # output cap with marker
  integration/
    run_test.go                # build tag: integration; one test per language
```

---

## Stage-switching mechanism

| What changes      | Stage 1 → 2                              | Stage 2 → 3                        |
|-------------------|------------------------------------------|------------------------------------|
| `languages.yaml`  | Add 5 more language entries              | No change                          |
| `Dockerfile`      | `apt-get install` the 5 runtimes         | No change                          |
| `config.yaml`     | —                                        | Tune `max_concurrent` if desired   |
| Go code           | None                                     | None                               |
| Documentation     | —                                        | Write `docs/benchmarks.md`         |

Stage 1 ships with `py3` + `cpp` in the YAML. Everything else — `/readyz`, `/info`, flag allowlists, bounded concurrency, security hardening, output truncation — is live from the first commit.

---

## Key design decisions

### 1. Sandbox interface

```go
type Sandbox interface {
    Build(ctx context.Context, job BuildJob) BuildResult
    Run(ctx context.Context, job RunJob) TestResult
}
```

`NsjailSandbox` and `MockSandbox` both satisfy this. `main.go` selects based on a config field (`sandbox_backend: nsjail|mock`). Tests inject the mock; production uses nsjail.

### 2. Concurrency: semaphore, not goroutine pool

```go
type Semaphore struct { ch chan struct{} }

func (s *Semaphore) Acquire(ctx context.Context) error {
    select {
    case s.ch <- struct{}{}: return nil
    case <-ctx.Done():       return ctx.Err()
    }
}
```

`chan struct{}` sized `MaxConcurrent`. If `MaxConcurrent == 0`, defaults to `runtime.NumCPU()`. Requests block and queue — they never get a `503` because the semaphore is full.

### 3. Template expansion in registry

```yaml
# configs/languages.yaml
args: ["{{flags}}", "-o", "{{artifact}}", "{{source}}"]
```

`template.Expand(args []string, vars map[string]string) []string` does string replacement. `{{flags}}` expands to N separate elements (one per flag), not one joined string. Arguments go directly to `os/exec.Command(cmd, args...)` — no shell involved anywhere.

### 4. All 7 security holes closed from day 1

| Hole | Fix location |
|------|-------------|
| Path traversal via filename | `validation/filename.go`: reject anything with `/`, `\`, `..`, leading `.` |
| Shell for directory operations | `runner/workdir.go`: only `os.MkdirTemp`, `os.WriteFile`, `os.RemoveAll` — never `exec("rm -rf ...")` |
| Compiler flag injection | `validation/flags.go`: allowlist per language, glob match for `-std=*`, 400 on anything unlisted |
| No request size limits | `handlers/run.go`: `http.MaxBytesReader` + max source bytes + max tests count check |
| UID collision under load | `runner/workdir.go`: `os.MkdirTemp` is collision-proof by design |
| Unbounded child output | `sandbox/nsjail/nsjail.go`: `io.LimitReader(stdout, MaxOutputBytes)`, append `[truncated]` marker |
| Stale jail directories | `runner/workdir.go`: `defer os.RemoveAll(dir)` + `StartupSweep(jailBase, 10*time.Minute)` at boot |

### 5. Status roll-up

```
build failed → top = build_failed, every test.status = not_executed
build ok     → top = first test status that is not "accepted"
             → if all accepted → top = accepted
```

Implemented in `runner/pipeline.go` as a pure function with no sandbox dependency — easy to unit test.

### 6. `/readyz` design

At startup and on each `/readyz` call, run per-language smoke probes (e.g. `python3 --version`) via `exec.CommandContext`. Cache results for 30 seconds to avoid hammering on every health check. Returns `503` with per-language breakdown if any probe fails. nsjail binary is checked with `os.Stat` + executable bit.

---

## `configs/languages.yaml` — Stage 1 content

```yaml
languages:
  - id: py3
    name: Python 3
    source_filename: solution.py
    smoke_cmd: [/usr/bin/python3, --version]
    run:
      cmd: /usr/bin/python3
      args: ["{{source}}"]
      limits: { wall_time_s: 9, memory_kb: 102400, max_processes: 100 }

  - id: cpp
    name: C++
    source_filename: solution.cpp
    artifact: solution
    smoke_cmd: [/usr/bin/g++, --version]
    build:
      cmd: /usr/bin/g++
      args: ["{{flags}}", -o, "{{artifact}}", "{{source}}"]
      limits: { wall_time_s: 5, memory_kb: 1048576, max_processes: 100 }
      flag_allowlist: [-O0, -O1, -O2, -O3, -Wall, -Wextra, "-std=*"]
    run:
      cmd: ./{{artifact}}
      limits: { wall_time_s: 3, memory_kb: 524288, max_processes: 64 }
```

Stage 2: add `c`, `java`, `bash`, `node`, `verilog` blocks to this file. One YAML edit, no Go.

---

## Wiring in `main.go`

```go
cfg  := config.Load()
reg  := registry.MustLoad(cfg.LanguagesFile)    // fatal if any language misconfigured
sbox := nsjail.New(cfg.NsjailBin, cfg.JailDir)
sem  := concurrency.NewSemaphore(cfg.MaxConcurrent)
st   := stats.New(cfg.JailDir)
run  := runner.New(reg, sbox, sem, st, cfg)

runner.StartupSweep(cfg.JailDir, 10*time.Minute) // clean orphan dirs

s := server.NewServer(cfg.Port)
s.Router.GET("/healthz",  handlers.Health())
s.Router.GET("/readyz",   handlers.Readyz(reg, sbox))
s.Router.GET("/info",     handlers.Info(reg, sbox, st, cfg))
s.Router.POST("/run",     handlers.Run(run, cfg))
```

Everything is injected. Handlers are constructor functions, not globals. Swapping the sandbox backend (e.g. mock for tests) requires changing one line.

---

## Implementation order

1. `internal/config` — foundation; everything else reads from it
2. `internal/registry` + `configs/languages.yaml` — language loading and template expansion; pure, testable immediately
3. `internal/validation` — filename, flags, limits; pure functions, table-driven tests
4. `internal/sandbox/nsjail` — the real sandbox; most complex piece
5. `internal/sandbox/mock` — for unit tests
6. `internal/runner` — workdir + pipeline + concurrency; wires registry and sandbox
7. `internal/stats` — atomic counters; trivial
8. `internal/handlers` — HTTP layer; thin wrappers over runner
9. `cmd/goboxd/main.go` — wire everything
10. `tests/unit` — validation, status roll-up, truncation
11. `tests/integration` — one end-to-end test per language (build tag `integration`)
12. Dockerfile — language toolchains in runtime stage; fix `cmd/goboxd` build path
13. `docs/` — `api.md`, `languages.md`, `security.md`, `architecture.md`

---

## What does not change between stages

- All Go source code
- The HTTP contract (handlers return the full spec-defined schema from day 1)
- Security measures (implemented once, always on)
- Concurrency (pool always running, sized by config)
- `/readyz` and `/info` (auto-reflect whatever the YAML says)

The only things that grow between stages are `configs/languages.yaml` (more language entries), `Dockerfile` (more toolchain install lines), and `docs/benchmarks.md`.
