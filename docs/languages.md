# Languages

Languages are data, not code. Every supported language is one entry in
[`configs/languages.yaml`](../configs/languages.yaml); the Go binary has no
per-language branches. Adding one is a YAML block, a Dockerfile install script,
and a smoke probe — no recompilation of the service logic.

## Registered languages

| id        | Name       | Build               | Run                  | Source file     | Artifact       |
| --------- | ---------- | ------------------- | -------------------- | --------------- | -------------- |
| `c`       | C          | `gcc`               | `./solution`         | `solution.c`    | `solution`     |
| `cpp`     | C++        | `g++`               | `./solution`         | `solution.cpp`  | `solution`     |
| `py3`     | Python 3   | —                   | `python3 solution.py`| `solution.py`   | —              |
| `bash`    | Bash       | —                   | `bash solution.sh`   | `solution.sh`   | —              |
| `java`    | Java       | `javac`             | `java Solution`      | `Solution.java` | `Solution`     |
| `js`      | JavaScript | —                   | `node solution.js`   | `solution.js`   | —              |
| `go`      | Go         | `go build`          | `./solution`         | `solution.go`   | `solution`     |
| `rust`    | Rust       | `rustc`             | `./solution`         | `solution.rs`   | `solution`     |
| `verilog` | Verilog    | `iverilog`          | `vvp solution.vvp`   | `solution.v`    | `solution.vvp` |

The seven in scope for the hackathon are `c`, `cpp`, `java`, `py3`, `bash`,
`js`, and `verilog`. `go` and `rust` are extra languages, each registered the
same way.

## Per-language defaults

`limits` below are the language defaults. A request may lower or raise any field
via `build.limits` / `run.limits`; a missing or zero field falls back to these.

| id        | Build limits (wall_s / mem_kb / procs) | Run limits (wall_s / mem_kb / procs) | Build flag allow-list                                |
| --------- | -------------------------------------- | ------------------------------------ | ---------------------------------------------------- |
| `c`       | 5 / 1048576 / 100                      | 3 / 524288 / 64                      | `-O0 -O1 -O2 -O3 -Wall -Wextra -std=*`               |
| `cpp`     | 5 / 1048576 / 100                      | 3 / 524288 / 64                      | `-O0 -O1 -O2 -O3 -Wall -Wextra -std=*`               |
| `py3`     | —                                      | 9 / 102400 / 100                     | —                                                    |
| `bash`    | —                                      | 9 / 102400 / 100                     | —                                                    |
| `java`    | 10 / 524288 / 100                      | 5 / 524288 / 64                      | (none)                                               |
| `js`      | —                                      | 9 / 102400 / 100                     | —                                                    |
| `go`      | 30 / 1048576 / 100                     | 5 / 524288 / 64                      | (none)                                               |
| `rust`    | 10 / 1048576 / 100                     | 3 / 524288 / 64                      | `-O --edition=* -C opt-level=*`                      |
| `verilog` | 10 / 524288 / 100                      | 5 / 524288 / 64                      | (none)                                               |

A language with no `flag_allowlist` rejects any client-supplied build flag. A
language with no `build` block rejects any `build` block in the request.

## Filename rules

Both `source_filename` and `artifact_filename` must be a single path component:
no `/` or `\`, no leading dot, no `..`, at most 255 characters. See
[security.md](security.md#1-path-traversal-via-filename). If the request omits
them, the language defaults from the table above are used.

Java is the case that needs request-supplied names in practice: the public class
must match the filename, so a submission with `public class Solution` needs
`source_filename: Solution.java` and `artifact_filename: Solution`. The defaults
already cover the `Solution` convention; override them only if the public class
is named differently.

## Toolchains that need extra jail wiring

The jail runs with `--disable_proc`, so any toolchain that resolves its own
install path through `/proc/self/exe` needs that path supplied explicitly. The
registry handles this with two optional per-language fields:

- `env` — extra environment variables injected into both the build and run
  jails.
- `mounts` — extra host paths bind-mounted read-only into the jail (skipped if
  absent on the image).

| id        | Extra wiring                                                                                     |
| --------- | ----------------------------------------------------------------------------------------------- |
| `java`    | `env: LD_LIBRARY_PATH=/usr/lib/jvm/java-17-openjdk-amd64/lib`, `mounts: [/etc/java-17-openjdk]`. The launcher's `$ORIGIN` RUNPATH needs `/proc/self/exe`; pointing the loader at the JDK lib dir directly avoids it. |
| `go`      | `env: GOROOT=/usr/local/go`. `go` otherwise derives `GOROOT` from `/proc/self/exe`.             |
| `rust`    | `build args` pass `--sysroot=/usr`. `rustc` otherwise derives its sysroot from `/proc/self/exe`; the linker `cc` is found via `PATH` in the read-only `/usr` mount. |
| `verilog` | None. `iverilog`/`vvp` resolve their backend and VPI modules from a compiled-in prefix under `/usr`, which is already bind-mounted. |

Everything else (`c`, `cpp`, `py3`, `bash`, `js`) works with only the default
read-only system mounts.

## Placeholder semantics

Build and run `args` use two placeholders, expanded against the validated
filenames:

- `{{source}}` — the source filename inside the work directory.
- `{{artifact}}` — the artifact filename (the build output, or the run target).
- `{{flags}}` — replaced in-place by the validated, allow-listed flag list. It
  expands to zero or more argv entries, not a single joined string.

A run `cmd` that is not an absolute path (e.g. `solution`) is prefixed with
`./` so the compiled artifact is executed from the work directory. The work
directory is the jail's `cwd`, so bare filenames resolve correctly.

## Adding a language

The target is under 30 minutes with no Go change. Three steps:

1. **YAML.** Add a block to [`configs/languages.yaml`](../configs/languages.yaml):

   ```yaml
   - id: ruby
     name: Ruby
     source_filename: solution.rb
     smoke_cmd: [/usr/bin/ruby, --version]
     run:
       cmd: /usr/bin/ruby
       args: ["{{source}}"]
       limits: { wall_time_s: 9, memory_kb: 102400, max_processes: 100 }
   ```

   For a compiled language, add a `build` block with `cmd`, `args`, `limits`,
   and an optional `flag_allowlist`. If the toolchain resolves paths via
   `/proc/self/exe`, add `env` and/or `mounts`.

2. **Install script.** Add `scripts/lang_install/<lang>.sh`. It installs the
   toolchain and self-verifies by compiling and running a hello program the same
   way the jail will (see [`rust.sh`](../scripts/lang_install/rust.sh) for the
   pattern). The Dockerfile runs every script in this directory automatically.

3. **Smoke probe.** The `smoke_cmd` you set in step 1 is what `/readyz` runs.
   Rebuild, hit `/readyz`, and confirm the new id reports `ok: true` with a
   version string. `/info` lists it automatically.

Startup validation rejects a language that is missing `id`, `name`, `run.cmd`,
or that declares a `build` block without `build.cmd`, and rejects duplicate ids.
A bad entry fails the process at boot with a named error rather than failing a
request later.
