# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Planning and progress

Before any non-trivial change, read these two files first:

- `plan.md` — full architecture: package structure, design decisions, stage-switching mechanism, implementation order. Treat it as the source of truth for how the codebase should be shaped.
- `progress.md` — checklist of every task across all three stages. **Update it immediately when a task completes** — check the box, do not batch updates.

When implementing a task from `progress.md`, confirm it matches the design in `plan.md` before writing code. If a decision in `plan.md` needs to change, update `plan.md` first, then proceed.

## What this is

goboxd is a hackathon submission (Paradox 2026) for a Go HTTP service that compiles/runs untrusted code inside nsjail sandboxes and returns per-test results. The full brief lives in `docs/goboxd.spec.md` — read it before any non-trivial change. It defines the `POST /run` JSON contract, the language-registry YAML shape, the seven security holes to close, the concurrency/benchmarking bar, and the judging weights. `docs/goboxd.desc.md` is the higher-level pitch.

Module path: `github.com/ethicks-x/goboxd`. Go 1.23.

## Commands

Everything runs in containers — the host does not need Go, nsjail, or any language toolchain. The `tools` compose service is a builder-image shell that mounts the repo at `/src`.

```
make build         # docker compose build goboxd
make run           # docker compose up goboxd      (serves :8080)
make test          # go test ./...                 (inside tools container)
make integration   # go test -tags=integration ./tests/...
make lint          # golangci-lint run ./...
```

Single-test invocation goes through the same `tools` runner, e.g.:
```
docker compose --profile tools run --rm tools go test ./internal/server -run TestRouter
```

Note: the spec also calls for `make load` (load-test target) — not yet wired up.

## Architecture

The codebase is in an early-prototype state; only the HTTP scaffolding exists. The runtime/sandbox/language-registry/concurrency layers described in the spec are not yet implemented.

- `internal/main.go` — process entry point. Constructs `server.Server`, registers `LoggingMiddleware` + `RecoveryMiddleware`, wires routes (`/`, `/healthz`, `/run`, plus a not-found handler), starts the listener in a goroutine, and handles SIGINT/SIGTERM with a 5s graceful shutdown.
- `internal/server/` — a small hand-rolled HTTP framework on top of `net/http`:
  - `server.go` — `Server` wraps `*http.Server`; `Run()` blocks on `ListenAndServe`, `Shutdown(ctx)` delegates.
  - `router.go` — exact-match + `*`-wildcard segment routing keyed by `method → path → Handler`. Wildcard match requires equal segment count. Not a trie; fine for a handful of routes.
  - `middleware.go` — `Middleware = func(Handler) Handler`, applied in registration order via `Chain` inside `Router.ServeHTTP` (so middleware runs per route lookup, after the 404 branch).
  - `logstyle.go` — lipgloss-styled log lines (`StyledServerStart`, `StyledRequest`, etc.). All user-facing log strings flow through here.
- `internal/handlers/handlers.go` — endpoint handlers. `RunHandler` currently just echoes back a valid JSON body; the real sandbox pipeline is the work to be done.
- `cmd/goboxd/` — empty. The Dockerfile's final build step is `go build ./cmd/goboxd`, which means **the container build is currently broken** until `main.go` is moved from `internal/` to `cmd/goboxd/` (or the Dockerfile is updated). Worth fixing before touching anything else that depends on `make build`/`make run`.
- `tests/` — empty; integration tests not yet written.

### Dockerfile shape

Three stages, all in one `Dockerfile`:
1. `nsjail-builder` — clones `github.com/google/nsjail` pinned to tag `3.4` (via `ARG NSJAIL_VERSION`) and compiles it.
2. `builder` — Go toolchain + `golangci-lint` + the nsjail binary + the repo source; produces `/out/goboxd`. This is also the image used by the `tools` compose service for `make test`/`make lint`.
3. `runtime` — slim Debian with just the nsjail binary, the compiled `goboxd`, and the shared libs nsjail needs (`libnl-route-3-200`, `libprotobuf32`).

The compose `goboxd` service runs `privileged: true` because nsjail needs namespace/cgroup capabilities. When adding language toolchains for stage 2, install them into the `runtime` stage (and into `builder` only if needed for tests).

## Conventions worth knowing

- The spec is explicit about README style: no AI filler, no marketing words ("elegant", "robust", "seamlessly", "leverage"), no emoji. Same bar applies to anything human-readable you generate.
- Per the spec, adding a language must require **no Go code change** — only a YAML entry, an install step in the Dockerfile, and a smoke probe. Resist the urge to special-case languages in Go.
- `5xx` is reserved for *server* failures. User-code crashes, build failures, timeouts, OOMs all return `200` with a structured status — see the status vocabulary table in `docs/goboxd.spec.md` §04.
