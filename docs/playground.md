# Playground

The playground is a web UI for driving the goboxd API from a browser. It is
served by the same process as the JSON API, so nothing extra needs to run.

```
GET /playground               the page
GET /playground/examples.js   the bundled demo programs it loads
```

Start the service and open the page:

```sh
make run
# then visit http://localhost:8080/playground
```

The page calls the API at `http://localhost:8080` directly (`/run`, `/info`,
`/readyz`). It works as-is when the service is reachable at that address on the
machine running the browser. Behind a different host or port, that base address
no longer resolves and the calls fail.

## Layout

The page is split into an editor on the left and results on the right, with a
toolbar across the top.

- **Language** — selects the registered language. The editor switches syntax
  highlighting to match.
- **Examples** — a dropdown of bundled demo programs (hello, echo-upper,
  sum-two, factorial, reverse, count-vowels, palindrome, fizzbuzz, and two
  Verilog programs). Pick one and **Load** to drop its source and test cases
  into the editor.
- **Source** — a CodeMirror editor for the program.
- **Test cases** — one or more `stdin` / expected `stdout` pairs. **Add** adds a
  case. These map straight to the `tests` array in the `/run` request.
- **Run** — sends the current language, source, and test cases to `POST /run`
  and renders the response.

## Results

Each test is shown with its status from the API's
[status vocabulary](api.md#status-vocabulary) — `accepted`, `wrong_output`,
`runtime_error`, `time_exceeded`, and the rest — alongside the program's stdout,
stderr, and timing. When the build fails, the build output is shown and the
tests are reported as `not_executed`, matching the API contract: a failed build
or a crashing program still returns `200`, never a `5xx`.

## Service status

A status panel reads `GET /info` and `GET /readyz`. A readiness indicator in the
toolbar reflects `/readyz`; opening the panel shows the registered languages
with their probed versions and the readiness of nsjail and each language
toolchain. **Refresh** re-fetches both. This is a convenient way to confirm,
from the browser, which languages the running build actually has installed.

## Saved snippets

The current source and test cases can be saved to the browser's local storage
and reloaded later. This is per-browser and client-side only — goboxd itself has
no persistence, and saved snippets never leave the machine.

## How it fits

The playground is a plain client of the public API. It is implemented in
[`internal/playground`](../internal/playground): the page and the demo programs
are `//go:embed`-ed into the binary, so the UI ships inside the single
executable with no separate asset files. CodeMirror is the one external
dependency, pulled from a CDN at page load. The package has no link to the
runner or sandbox; everything it does goes through `/run`, `/info`, and
`/readyz`, the same endpoints documented in [api.md](api.md).
