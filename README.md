<div align="center">

# goboxd

**A Go HTTP service for executing untrusted code in isolated sandboxes.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.23-00ADD8.svg?logo=go&logoColor=white)](https://go.dev)
[![Docker](https://img.shields.io/badge/Docker-Required-2496ED.svg?logo=docker&logoColor=white)](https://www.docker.com)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/thesouldev/goboxd/pulls)

</div>

---

## Overview

goboxd is an HTTP service written in Go that compiles and runs untrusted code inside isolated sandboxes and returns the result. Optional test cases can be supplied to assert behaviour against expected output. It is built for safe execution of code across many languages, with strict isolation, bounded concurrency, and a plug and play language registry.

## Features

- Plug and play language registry driven by YAML, with no Go code change to add a language
- Process isolation using nsjail over Linux namespaces and cgroups
- Bounded concurrency: requests queue on a semaphore rather than failing under load
- Per request resource limits for wall time, memory, and processes
- Per test results with a structured status vocabulary; user code outcomes are `200`, not `5xx`
- Liveness, readiness, and build-info endpoints for orchestration
- Fully containerised; the host needs neither Go nor nsjail

Nine languages are registered out of the box: C, C++, Python 3, Bash, Java,
JavaScript, Go, Rust, and Verilog.

## Getting started

### Prerequisites

- Docker with Compose v2

No Go toolchain or system dependencies are required on the host. Everything runs in containers.

### Installation

```sh
git clone https://github.com/ethicks-x/goboxd.git
git checkout team/spaced
cd goboxd
make build
```

### Usage

```sh
make build        # build the service and nsjail images
make run          # start the service on :8080
make dev          # start the service with live reload for development
make test         # run all tests
make unit         # run unit tests
make integration  # run end to end tests
make corpus       # run the corpus suite for a language
make load         # drive the concurrency load suite
make security     # run the security test suite
make lint         # run static analysis
```

Send a request:

```sh
curl -sS -X POST http://localhost:8080/run \
  -H 'Content-Type: application/json' \
  --data-binary @docs/examples/run_py3.json | jq
```

## Project structure

```
.
├── cmd/goboxd/   binary entry point
├── internal/     private application packages
├── configs/      language registry and service config (YAML)
├── docs/         api, languages, security, benchmarks, architecture
└── tests/        integration and load suites
```

## Documentation

- [API](docs/api.md) — endpoints, request and response contract, status vocabulary
- [Languages](docs/languages.md) — the registry, per-language defaults, adding a language
- [Security](docs/security.md) — the seven closed holes and defence in depth
- [Architecture](docs/architecture.md) — request flow, packages, concurrency model
- [Benchmarks](docs/benchmarks.md) — how concurrency is measured and the results

## Contributing

Contributions are welcome. Open an issue to discuss substantial changes before sending a pull request.

## License

This project is distributed under the GNU General Public License v3.0. See [LICENSE](LICENSE) for the full text.
