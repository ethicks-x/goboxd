# Architecture

This is a map for someone reading the codebase for the first time. It covers how
a request flows through the system, what each package owns, and the decisions
that shaped the layout.

## One request, end to end

```
POST /run
  │
  ├─ server.Router            method+path lookup, middleware chain
  │     └─ CORS → Logging → Recovery
  │
  ├─ handlers.Run             MaxBytesReader, JSON decode (strict),
  │                           size/test-count caps, → runner.RunRequest
  │
  └─ runner.Run
        ├─ registry.Lookup    resolve language, or 400 unknown_language
        ├─ validation         filename + flag allow-list + limit merge (→ 400)
        ├─ Semaphore.Acquire  block until a concurrency slot is free
        ├─ SafeWorkDir        fresh temp dir, defer cleanup
        ├─ WriteSource        write source into the work dir
        ├─ sandbox.Build      nsjail compile step (skipped if interpreted)
        ├─ sandbox.Run × N    nsjail run, once per test case
        ├─ compareOutput      exact / whitespace / wrong per test
        └─ RollUp             top-level status, → 200 JSON
```

Validation that can reject the request happens *before* a concurrency slot is
taken, so bad requests fail fast and never occupy the pool.

## Packages

```
cmd/goboxd/         process entry point and wiring
internal/
  config/           Config struct, YAML load, GOBOXD_* env overrides
  registry/         Language struct, YAML registry, startup validation
  validation/       filename rules, flag allow-list, limit merge
  sandbox/          Sandbox interface + BuildJob/RunJob/results
    nsjail/         the real backend (argv builder, exec, output cap)
    mock/           host-exec backend, no isolation (tests only)
  runner/           pipeline orchestration, concurrency, workdir, probes
  stats/            atomic counters + disk-free for /info
  handlers/         HTTP handlers: run, healthz, readyz, info
  playground/       embedded web UI served at /playground
  server/           small net/http framework: router, middleware, JSON
```

### `cmd/goboxd`

`main.go` is the only wiring. It loads config, loads the language registry
(`MustLoad` — a bad YAML entry panics at boot, not mid-request), picks the
sandbox backend, runs a startup sweep of orphaned work directories, constructs
the stats sink, semaphore, runner, and prober, registers middleware and routes,
and starts the server with a 5-second graceful shutdown on `SIGINT`/`SIGTERM`.

### `internal/config`

`Config` is loaded from `config.yaml`, then `GOBOXD_*` environment variables
override it. `max_concurrent: 0` resolves to `runtime.NumCPU()` at startup. The
size caps (`max_request_bytes`, `max_source_bytes`, `max_output_bytes`,
`max_tests`) and the CORS policy live here.

### `internal/registry`

`Language` is the YAML shape: id, name, filenames, `smoke_cmd`, optional `env`
and `mounts`, an optional `build` `CommandSpec`, and a required `run`
`CommandSpec`. `Load` validates every entry and rejects duplicate ids; `Lookup`
and `All` are the read API. This package is the entire "plug-and-play" surface —
nothing else in the codebase knows a language by name.

### `internal/validation`

Three independent, pure functions, each unit-tested without a sandbox:

- `ValidateFilename` — single-component filenames only.
- `FilterFlags` — per-language allow-list with trailing-`*` prefix matching.
- `MergeLimits` — request overrides on top of language defaults, zero means
  "unset".

### `internal/sandbox`

`Sandbox` is a two-method interface (`Build`, `Run`). Two implementations:

- `nsjail` — the production backend. `baseJailArgs` builds the nsjail argv: no
  `--chroot`, a curated read-only mount set, `/dev` nodes, cgroup memory/PID
  caps, wall-time limit, per-language env, and the writable work directory.
  `runCmd` execs it with `os/exec`, feeds stdin, and captures bounded
  stdout/stderr through `limitedWriter`. See [security.md](security.md) for what
  each flag defends against.
- `mock` — runs the command on the host with no isolation. Used by unit tests
  so the pipeline can be exercised without nsjail or root.

The backend is chosen by `sandbox_backend` config (`nsjail` default, `mock` for
tests), so the runner is identical in both.

### `internal/runner`

The orchestration core.

- `runner.go` — `Run` is the pipeline above: validate, acquire, workdir, build,
  per-test run, roll up. Status string constants and `RollUp` live in
  [`errors.go`](../internal/runner/errors.go) and the pipeline file; they are
  the single source of truth for status spelling.
- `concurrency.go` — `Semaphore` is a buffered channel. `Acquire` blocks until a
  slot frees or the request context is cancelled; it never rejects. Queueing,
  not `503`, is the contract under load.
- `workdir.go` — `SafeWorkDir` (unique temp dir + cleanup closure) and
  `StartupSweep` (boot-time orphan reaper).
- `probe.go` — `Prober` runs the nsjail check and each language's `smoke_cmd`,
  caches the result for the configured TTL, and serves both `/readyz` and the
  version strings in `/info`.

### `internal/playground`

A single self-contained web UI for driving the API from a browser, served at
`GET /playground`. The page (HTML with inline CSS/JS, CodeMirror from a CDN) and
its bundled demo programs are `//go:embed`-ed into the binary, so there are no
runtime asset files to ship. Two handlers serve them: `Handler` returns the
page, `ExamplesHandler` serves `examples.js` at `/playground/examples.js`. The
package has no dependency on the runner or sandbox — it is a client of the same
public `/run`, `/info`, and `/readyz` endpoints. See [playground.md](playground.md).

### `internal/server`

A small hand-rolled layer over `net/http`. `Router` is a `method → path →
Handler` map with exact match plus a `*`-segment wildcard fallback (not a trie;
fine for a handful of routes). Middleware is `func(Handler) Handler`, applied per
lookup so it also wraps the 404 path — CORS preflight and logging still run on
unmatched routes. `WriteJSON`/`WriteError` are the response helpers.

### `internal/stats`

Process-wide atomic counters (`in_flight`, `jobs_total`,
`jobs_failed_internal`, `last_error_at`) plus a fresh `statfs` disk-free reading
for the jail directory, surfaced through `/info`.

## Concurrency model

One global semaphore bounds in-flight jobs at `max_concurrent` (default
`NumCPU()`). A request blocks on `Acquire` until a slot is free, so a burst of
clients queues rather than failing. The slot is held for the whole pipeline —
build plus every test — and released on any exit path via `defer`. The HTTP
server itself imposes no separate connection limit; the semaphore is the single
throttle, which keeps the queue depth observable (`in_flight_jobs` in `/info`)
and the behaviour predictable under sustained load.

Because the work is CPU- and sandbox-bound, the default of `NumCPU()` matches
the machine; raise `GOBOXD_MAX_CONCURRENT` to trade latency for throughput on a
box with spare cores. See [benchmarks.md](benchmarks.md) for measured behaviour.

## Container shape

Everything runs in Docker; the host needs neither Go nor nsjail. The
[`Dockerfile`](../Dockerfile) has three stages:

1. `nsjail-builder` — clones nsjail pinned to tag `3.4` and compiles it.
2. `builder` — Go toolchain + linters + the nsjail binary + language toolchains
   (installed by `scripts/install.sh`, which runs every
   `scripts/lang_install/*.sh`). Produces `/out/goboxd`. This image also backs
   the `tools`/`dev` compose services.
3. `runtime` — slim Debian with just nsjail, the compiled binary, the language
   toolchains, and `configs/`.

The `goboxd` compose service runs `privileged` because nsjail needs namespace
and cgroup capabilities to construct the jail — the untrusted code inside holds
none of that. See [`docker-compose.yml`](../docker-compose.yml).

## Why these choices

- **net/http, no framework.** The routing need is four static paths. A
  dependency-free router and a `func(Handler) Handler` middleware chain are
  smaller than pulling in a framework, and keep the request path easy to read.
- **Languages as data.** A new language is YAML + an install script + a smoke
  probe. The Go code never switches on language id, so adding one cannot
  introduce a logic bug in the pipeline.
- **Sandbox behind an interface.** The `mock` backend lets the whole pipeline be
  unit-tested on a laptop without root or nsjail, while production uses the real
  jail through the same code path.
- **Fail before you queue.** All request validation runs before `Acquire`, so
  malformed input never consumes a concurrency slot.
- **`200` for user-code outcomes.** Crashes, timeouts, OOMs, and wrong answers
  are data, returned with a structured status. `5xx` means the service broke,
  which is what monitoring should page on.
