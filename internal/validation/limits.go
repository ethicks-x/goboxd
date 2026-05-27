package validation

import "github.com/ethicks-x/goboxd/internal/registry"

// MergeLimits applies per-request limit overrides on top of language defaults.
// Any zero field in req is treated as "not set" and falls back to the
// corresponding field in defaults.
func MergeLimits(req, defaults registry.Limits) registry.Limits {
	out := defaults
	if req.WallTimeS > 0 {
		out.WallTimeS = req.WallTimeS
	}
	if req.MemoryKB > 0 {
		out.MemoryKB = req.MemoryKB
	}
	if req.MaxProcesses > 0 {
		out.MaxProcesses = req.MaxProcesses
	}
	return out
}
