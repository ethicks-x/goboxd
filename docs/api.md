# API

goboxd speaks plain JSON over HTTP. There is no authentication, no rate
limiting, and no persistence. The JSON API exposes four endpoints, plus a web
playground served from the same process.

| Method | Path                      | Purpose                                  |
| ------ | ------------------------- | ---------------------------------------- |
| POST   | `/run`                    | Build and run a snippet against tests.   |
| GET    | `/healthz`                | Liveness. Always cheap.                  |
| GET    | `/readyz`                 | Readiness. nsjail + per-language probes. |
| GET    | `/info`                   | Build info, languages, limits, stats.    |
| GET    | `/playground`             | The web UI. See [playground.md](playground.md). |
| GET    | `/playground/examples.js` | Bundled demo programs the UI loads.      |

`GET /` returns a plain-text banner and any unrouted path returns `404`.

## POST /run

Builds the source (for compiled languages), runs the produced program once per
test case, compares each program's stdout to the expected output, and returns a
per-test result.

### Request

```json
{
  "language": "cpp",
  "source": "#include <iostream>\nint main(){int a,b;std::cin>>a>>b;std::cout<<a+b;}",
  "source_filename": "solution.cpp",
  "artifact_filename": "solution",
  "build": {
    "limits": { "wall_time_s": 5, "memory_kb": 1048576, "max_processes": 100 },
    "flags": ["-O2", "-std=c++17"]
  },
  "run": {
    "limits": { "wall_time_s": 3, "memory_kb": 524288, "max_processes": 64 },
    "flags": []
  },
  "tests": [
    { "stdin": "2 3\n", "expected_stdout": "5" }
  ]
}
```

| Field               | Required | Notes                                                                                              |
| ------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `language`          | yes      | Must match a registered language id, else `400 unknown_language`.                                  |
| `source`            | yes      | UTF-8 source text. Capped at `max_source_bytes` (default 64 KiB).                                   |
| `source_filename`   | no       | Single path component. Falls back to the language default. Validated (see [security](security.md)). |
| `artifact_filename` | no       | Single path component. Falls back to the language default. Only meaningful for compiled languages.  |
| `build`             | no       | `limits` and `flags` for the compile step. Rejected if the language has no build step.             |
| `run`               | no       | `limits` and `flags` for the run step.                                                              |
| `tests`             | yes      | At least one entry, at most `max_tests` (default 50). Each is `{stdin, expected_stdout}`.           |

`limits` is a partial override. Any field left out (or set to `0`) falls back to
the language default. `flags` are filtered against the per-language allow-list;
an unlisted flag fails the whole request with `400 disallowed_flag`. Unknown
JSON fields and trailing content after the top-level object are rejected.

### Response

`200` once the pipeline completes, regardless of whether the user's code built,
crashed, timed out, or produced the wrong answer. The HTTP status reflects the
service, not the submitted code.

```json
{
  "status": "accepted",
  "build": {
    "status": "ok",
    "stdout": "",
    "stderr": "",
    "duration_ms": 412
  },
  "tests": [
    {
      "status": "accepted",
      "stdout": "5",
      "stderr": "",
      "duration_ms": 38,
      "memory_peak_kb": 0
    }
  ]
}
```

For interpreted languages `build.status` is `ok` with empty output and zero
duration; there is no compile step.

> `memory_peak_kb` is reported as `0`. nsjail's per-process peak-RSS reporting
> is not wired back through the run path yet; the field is present for contract
> conformance.

### Status vocabulary

`build.status`:

| Value            | Meaning                                              |
| ---------------- | ---------------------------------------------------- |
| `ok`             | Compiled, or no build step needed.                   |
| `failed`         | Compiler exited non-zero (user error).               |
| `internal_error` | Sandbox or infrastructure failure during the build.  |

`tests[].status`:

| Value                         | Meaning                                                   |
| ----------------------------- | --------------------------------------------------------- |
| `accepted`                    | stdout matches `expected_stdout` exactly.                 |
| `wrong_output`                | stdout differs, even after whitespace normalization.      |
| `output_whitespace_mismatch`  | stdout matches once runs of whitespace are collapsed.     |
| `time_exceeded`               | Killed at the wall-time limit.                            |
| `memory_exceeded`             | Killed at the memory limit.                               |
| `runtime_error`               | Program exited non-zero.                                  |
| `not_executed`                | Build failed, so no test ran.                             |
| `internal_error`              | Sandbox failure while running this test.                  |

Top-level `status`:

`accepted` only if `build.status == ok` and every test is `accepted`. Otherwise
it is the first non-`accepted` test status in test order. If the build failed,
top-level is `build_failed` and every test is `not_executed`. If the build hit
an infrastructure failure, top-level is `internal_error`.

> Output comparison is two-tier: an exact byte match is `accepted`; otherwise,
> if both sides are equal after collapsing whitespace
> (`strings.Fields`-normalized), the result is `output_whitespace_mismatch`;
> otherwise `wrong_output`.

> A program killed by `SIGKILL` (nsjail's signal for both the time and memory
> limits) is currently reported as `time_exceeded`, since the cause is not read
> back from nsjail's log. A program that exits non-zero on its own is
> `runtime_error`.

### Errors

Anything that prevents execution returns a `4xx` (or `413`) with an error
envelope:

```json
{
  "error": {
    "code": "invalid_filename",
    "message": "source_filename: filename must be a single path component with no separators"
  }
}
```

| HTTP | `code`               | Cause                                                       |
| ---- | -------------------- | ---------------------------------------------------------- |
| 400  | `invalid_json`       | Malformed body, unknown field, or trailing content.        |
| 400  | `missing_field`      | `language`, `source`, or `tests` absent. Message names it. |
| 400  | `source_too_large`   | `source` exceeds `max_source_bytes`.                       |
| 400  | `too_many_tests`     | More than `max_tests` entries.                             |
| 400  | `unknown_language`   | `language` not in the registry.                            |
| 400  | `invalid_filename`   | `source_filename`/`artifact_filename` failed validation.   |
| 400  | `disallowed_flag`    | A build or run flag is not on the language allow-list.     |
| 413  | `request_too_large`  | Body exceeds `max_request_bytes` (default 4 MiB).          |
| 500  | `internal_error`     | Unexpected server failure before the pipeline ran.         |

`5xx` is reserved for the service. User-code crashes, build failures, timeouts,
and OOMs never produce a `5xx` — they come back `200` with a structured status.

## GET /healthz

Liveness. No dependencies touched.

```json
{ "status": "ok" }
```

## GET /readyz

Readiness. `200` only when the nsjail binary is present and runnable and every
registered language passes its smoke probe (`smoke_cmd`, e.g. `gcc --version`).
Otherwise `503`. Results are cached for `readyz_cache_ttl_s` (default 30s).

```json
{
  "status": "ready",
  "nsjail": { "ok": true },
  "languages": {
    "py3":  { "ok": true,  "version": "Python 3.11.2" },
    "java": { "ok": false, "error": "exec: \"/usr/bin/javac\": ..." }
  }
}
```

On any failure the top-level `status` is `degraded` and the HTTP code is `503`.

## GET /info

Always `200`. Reports build metadata, the registered languages with their probed
versions and default run limits, the configured limits, and live counters.

```json
{
  "build_info": { "version": "0.1.0", "commit": "9a2c357", "go_version": "go1.23.0" },
  "nsjail": { "path": "/usr/local/bin/nsjail", "version": "3.4" },
  "languages": [
    {
      "id": "py3",
      "name": "Python 3",
      "version": "Python 3.11.2",
      "default_run_limits": { "wall_time_s": 9, "memory_kb": 102400, "max_processes": 100 }
    }
  ],
  "limits": {
    "max_source_bytes": 65536,
    "max_tests": 50,
    "max_concurrent_jobs": 16,
    "max_request_bytes": 4194304,
    "max_output_bytes": 1048576
  },
  "stats": {
    "in_flight_jobs": 3,
    "jobs_total": 41892,
    "jobs_failed_internal": 4,
    "last_internal_error_at": "2026-05-04T11:22:09Z",
    "disk_free_bytes_jail_dir": 53687091200
  }
}
```

`commit` is read from the embedded VCS build info; `version` is set with
`-ldflags`. The language list and probe versions reflect whatever is in
`configs/languages.yaml` — no code lists languages by hand.

## Examples

Runnable request bodies live in [`docs/examples/`](examples/), one per language.

```sh
curl -sS -X POST http://localhost:8080/run \
  -H 'Content-Type: application/json' \
  --data-binary @docs/examples/run_py3.json | jq
```
