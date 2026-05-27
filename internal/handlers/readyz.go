package handlers

import (
	"net/http"

	"github.com/ethicks-x/goboxd/internal/runner"
	"github.com/ethicks-x/goboxd/internal/server"
)

type readyzResponse struct {
	Status    string                        `json:"status"`
	Nsjail    runner.ProbeStatus            `json:"nsjail"`
	Languages map[string]runner.ProbeStatus `json:"languages"`
}

// Readyz returns the /readyz handler. 200 only if nsjail and every language
// probe pass; otherwise 503 with the per-language breakdown.
func Readyz(p *runner.Prober) server.Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		snap := p.Snapshot(r.Context())

		ok := snap.Nsjail.OK
		for _, ls := range snap.Languages {
			if !ls.OK {
				ok = false
				break
			}
		}

		body := readyzResponse{
			Status:    "ready",
			Nsjail:    snap.Nsjail,
			Languages: snap.Languages,
		}
		status := http.StatusOK
		if !ok {
			body.Status = "degraded"
			status = http.StatusServiceUnavailable
		}
		server.WriteJSON(w, status, body)
	}
}
