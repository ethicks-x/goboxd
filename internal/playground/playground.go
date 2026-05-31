// Package playground serves a self-contained web UI for exercising the
// goboxd HTTP API: editing source, attaching test cases, calling POST /run,
// and surfacing the /info and /readyz status endpoints.
//
// The UI is an embedded HTML document (inline CSS/JS, CodeMirror pulled from a
// CDN) plus a single embedded examples.js holding the demo programs. Each is
// served by its own handler; register both routes (see ExamplesHandler).
package playground

import (
	_ "embed"
	"net/http"

	"github.com/ethicks-x/goboxd/internal/server"
)

//go:embed assets/index.html
var indexHTML []byte

//go:embed assets/examples.js
var examplesJS []byte

// Handler returns the GET /playground handler. It serves the embedded UI.
func Handler() server.Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(indexHTML)
	}
}

// ExamplesHandler returns the GET /playground/examples.js handler. It serves
// the embedded demo programs that the page script reads as EXAMPLES.
func ExamplesHandler() server.Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/javascript; charset=utf-8")
		w.Header().Set("Cache-Control", "no-cache")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(examplesJS)
	}
}
