package handlers

import (
	"net/http"

	"github.com/ethicks-x/goboxd/internal/server"
)

// Health returns the /healthz liveness handler. Always 200 once the process
// is up; readiness/probing belongs in /readyz.
func Health() server.Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		server.WriteJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	}
}
