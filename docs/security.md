# Security

The reference Python implementation ships with seven deliberate holes. All seven
are closed in goboxd. This document lists each one and the `file:line` where it
is closed. Line numbers refer to the state of the tree at the time of writing;
search for the named symbol if they have drifted.

Every build and run executes
inside nsjail with no `--chroot`: instead of chrooting to `/` (which would
expose `/home`, `/root`, `/etc/shadow`, and other requests' work directories to
untrusted code), nsjail builds a fresh tmpfs root and only the paths the
toolchains need are bind-mounted read-only. The per-request work directory is
the single writable location. See
[`internal/sandbox/nsjail/nsjail.go:140`](../internal/sandbox/nsjail/nsjail.go#L140)
(`baseJailArgs`) and the `systemMountsRO` allow-list above it.

## 1. Path traversal via filename

The reference joins the jail directory with a client-supplied filename and
writes with no validation, so `../../etc/passwd` or an absolute path escapes the
jail directory on the host.

Closed: every filename is validated before use.
[`internal/validation/filename.go:21`](../internal/validation/filename.go#L21)
(`ValidateFilename`) rejects empty names, anything over 255 characters, a
leading dot, any `/` or `\` separator, and any `..` substring. It is called for
both `source_filename` and `artifact_filename` in
[`internal/runner/runner.go:107`](../internal/runner/runner.go#L107) and
[`internal/runner/runner.go:116`](../internal/runner/runner.go#L116) before the
runner touches the filesystem. The source is then written with `os.WriteFile`
into the validated work directory at
[`internal/runner/workdir.go:34`](../internal/runner/workdir.go#L34)
(`WriteSource`).

## 2. Shell-style directory commands

The reference creates and deletes per-request directories by string-formatting
shell commands, which is an injection surface.

Closed: there is no shell anywhere in the path-handling code. Directories are
created with `os.MkdirAll` + `os.MkdirTemp` and removed with `os.RemoveAll` in
[`internal/runner/workdir.go:16`](../internal/runner/workdir.go#L16)
(`SafeWorkDir`). The sandbox is invoked with `os/exec` passing an explicit argv
slice — never a shell string — in
[`internal/sandbox/nsjail/nsjail.go:208`](../internal/sandbox/nsjail/nsjail.go#L208)
(`runCmd`). User input never reaches `/bin/sh`.

## 3. Compiler-flag injection

The reference appends arbitrary client args to `gcc`, `g++`, `javac`. Flags like
`-fplugin=`, `-x c`, `-B`, `--specs=`, `-Wl,`, or `@response_file` give
compile-time code execution.

Closed: every build and run flag passes a per-language allow-list before it can
reach the toolchain.
[`internal/validation/flags.go:13`](../internal/validation/flags.go#L13)
(`FilterFlags`) checks each flag against the language's `flag_allowlist`,
supporting an exact match or a trailing-`*` prefix match (so `-std=*` permits
`-std=c++17` but nothing else). A flag with no match fails the entire request
with `400 disallowed_flag`; no partial set is ever forwarded. Enforced in
[`internal/runner/runner.go:123`](../internal/runner/runner.go#L123) (build) and
[`internal/runner/runner.go:131`](../internal/runner/runner.go#L131) (run). A
language with no build step rejects any build flags outright
([`runner.go:128`](../internal/runner/runner.go#L128)). The allow-lists
themselves live in [`configs/languages.yaml`](../configs/languages.yaml).

## 4. No request size limits

The reference leaves source size, test count, per-test stdin/expected size, and
captured output unbounded.

Closed at both layers:

- HTTP layer ([`internal/handlers/run.go`](../internal/handlers/run.go)): the
  body is wrapped in `http.MaxBytesReader` capped at `max_request_bytes`
  ([line 52](../internal/handlers/run.go#L52)), the decoded `source` is checked
  against `max_source_bytes` ([line 81](../internal/handlers/run.go#L81)), and
  the test count against `max_tests` ([line 89](../internal/handlers/run.go#L89)).
  Oversize bodies return `413`.
- Sandbox layer ([`internal/sandbox/nsjail/nsjail.go`](../internal/sandbox/nsjail/nsjail.go)):
  `--rlimit_fsize` caps the size of any file the child can write
  ([line 153](../internal/sandbox/nsjail/nsjail.go#L153)), and captured
  stdout/stderr are bounded (see hole 6).

## 5. UID collisions under load

The reference picks a UID from a 30k-wide range and retries three times on
collision, then reuses directories.

Closed: each request gets a unique work directory from `os.MkdirTemp`, which
uses an atomically-incremented suffix and never returns the same path twice,
in [`internal/runner/workdir.go:20`](../internal/runner/workdir.go#L20). A
directory is never reused, so there is no UID/dir collision to retry. The jail
runs in `--mode o` (one isolated run per invocation) at
[`internal/sandbox/nsjail/nsjail.go:147`](../internal/sandbox/nsjail/nsjail.go#L147),
so there is no shared UID pool across concurrent requests.

## 6. Unbounded child output

Reading a child's full stdout into memory lets a runaway program OOM the host.

Closed: both streams are written through a `limitedWriter` that stops buffering
after `max_output_bytes` and appends a `\n[truncated]` marker, in
[`internal/sandbox/nsjail/nsjail.go:245`](../internal/sandbox/nsjail/nsjail.go#L245)
(`limitedWriter`), wired up in
[`internal/sandbox/nsjail/nsjail.go:224`](../internal/sandbox/nsjail/nsjail.go#L224)
(`runCmd`). The cap is configurable via `max_output_bytes` (default 1 MiB per
stream, per step) and falls back to a built-in default if unset.

## 7. Stale jail directories

A panic between create and cleanup leaks the work directory.

Closed on every exit path plus a boot-time sweep:

- `SafeWorkDir` returns a `cleanup` closure that the runner defers immediately
  after creation, so the directory is removed however the request exits —
  return, error, or panic unwound through `RecoveryMiddleware`. See the `defer
  cleanup()` at
  [`internal/runner/runner.go:149`](../internal/runner/runner.go#L149).
- `StartupSweep` deletes any `job-*` directory older than 10 minutes at boot, to
  reap orphans left by a hard crash, in
  [`internal/runner/workdir.go:43`](../internal/runner/workdir.go#L43), called
  from [`cmd/goboxd/main.go:42`](../cmd/goboxd/main.go#L42).

## Defence in depth beyond the seven

- **No network.** `--iface_no_lo` gives the jail no usable network interface, so
  untrusted code cannot reach out or be reached.
- **No host process visibility.** `--disable_proc` keeps `/proc` of the host out
  of the jail. (Per-language `env` such as `GOROOT` and Java's
  `LD_LIBRARY_PATH` exist precisely because toolchains can no longer resolve
  paths via `/proc/self/exe`.)
- **Memory and PID caps via cgroups.** `--cgroup_mem_max` caps real RSS and
  `--cgroup_pids_max` caps process count, so a fork bomb or allocation loop is
  contained by the kernel rather than the host running out.
- **Read-only system mounts.** `/usr`, `/bin`, `/lib`, and friends are mounted
  read-only; the host's `/home`, `/root`, and `/etc/shadow` are never mounted at
  all.
- **Privileged container, unprivileged code.** The container runs `privileged`
  because nsjail needs namespace and cgroup capabilities to build the jail. The
  untrusted code inside the jail holds none of that — it sees only the tmpfs
  root and the read-only mounts.
