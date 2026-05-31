# Benchmarks

Concurrency is judged on evidence, not vibes. This document describes how the
numbers are produced and records the results. **The results table must be filled
from a clean Docker run**, not from a debugger or a `go run` on the host — see
[How to reproduce](#how-to-reproduce). Numbers left as `—` have not yet been
captured on the measurement box.

## What is measured

The canonical case is "Hello World, py3": the smallest possible job, so the
measurement reflects the service's own overhead (queueing, workdir, nsjail
setup/teardown) rather than the user program. The request body is:

```json
{
  "language": "py3",
  "source": "import sys;sys.stdout.write('hi')",
  "tests": [{ "stdin": "", "expected_stdout": "hi" }]
}
```

It is fired at 1, 10, 50, and 100 concurrent clients. For each level the load
harness records requests/sec and the p50, p95, and p99 of end-to-end latency,
and asserts two contract properties:

- **No `5xx`.** A full pool must queue, never drop. Any `5xx` fails the run.
- **Every response `accepted`.** Correctness must hold under load, not just at
  rest.

The harness lives in [`tests/suites/load.ts`](../tests/suites/load.ts) and is
invoked by `make load`.

## How to reproduce

```sh
make build        # build the runtime image with all toolchains
make run          # start goboxd on :8080 (separate shell)
make load         # drive the load suite against it
```

`make load` runs the four concurrency levels and prints one line per scenario:

```
load · py3 hello world
  c=1    n=20  ok=20 4xx=0 5xx=0 acc=20  wall=…s  rps=…  p50=…ms p95=…ms p99=…ms
  c=10   n=200 ok=200 ...
  c=50   ...
  c=100  ...
```

Copy those numbers into the table below, and note the box you measured on.

## Results

Measurement box: **(fill in: CPU, cores, RAM, OS, Docker version)**
goboxd `max_concurrent`: **(fill in — default is `runtime.NumCPU()`)**
Date: **(fill in)**

### py3 "Hello World"

| Clients | Requests/sec | p50 (ms) | p95 (ms) | p99 (ms) | 5xx |
| ------- | ------------ | -------- | -------- | -------- | --- |
| 1       | —            | —        | —        | —        | 0   |
| 10      | —            | —        | —        | —        | 0   |
| 50      | —            | —        | —        | —        | 0   |
| 100     | —            | —        | —        | —        | 0   |

The `5xx` column must read `0` at every level for the run to pass.

## Behaviour checks beyond throughput

The same suite verifies that the service stays well-behaved under adversarial
load, not just fast:

| Check                       | Body                                  | Pass condition                                              |
| --------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| Latency floor               | `time.sleep(0.5)` at c=10             | p50 ≥ ~450 ms — the service does not "finish" before the program does, and adds little overhead on top. |
| Memory cap                  | allocate 512 MiB under a 50 MiB limit | `200` with status `memory_exceeded` or `runtime_error`, never `5xx`. |
| Output cap                  | write ~12 MiB to stdout               | `200`, stdout truncated with a `[truncated]` marker.       |

These map directly to security holes 4 and 6 (see [security.md](security.md))
and to the `200`-not-`5xx` contract for user-code failures.

## Notes on interpretation

- Latency at c=1 is the floor: one nsjail build/teardown plus a single Python
  start. Higher client counts above the concurrency limit add queue wait, which
  is expected and visible as growth in p95/p99 while rps plateaus.
- Per-request wall time is also logged by the service itself, so a slow request
  can be traced without the harness.
- A sustained-load run (longer than the short burst above) is part of judging;
  watch `in_flight_jobs` in `/info` during it to confirm the queue drains rather
  than growing without bound.
