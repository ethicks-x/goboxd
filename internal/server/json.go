package server

import (
	"encoding/json"
	"net/http"
)

// writeJSON serializes v as JSON with the given status code.
// Encoder errors are swallowed: the response is mid-write by then and
// the client has already received the status line.
func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// errorBody is the shared 4xx error shape: {"error": "...", "detail": "..."}.
func WriteError(w http.ResponseWriter, status int, code, detail string) {
	body := map[string]string{"error": code}
	if detail != "" {
		body["detail"] = detail
	}
	WriteJSON(w, status, body)
}
