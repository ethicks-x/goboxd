package handlers

import (
	"net/http"
	"runtime"
	"runtime/debug"
	"time"

	"github.com/ethicks-x/goboxd/internal/config"
	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/runner"
	"github.com/ethicks-x/goboxd/internal/server"
	"github.com/ethicks-x/goboxd/internal/stats"
)

// Version is overridden at build time via -ldflags "-X .../handlers.Version=...".
var Version = "0.1.0"

type buildInfo struct {
	Version   string `json:"version"`
	Commit    string `json:"commit"`
	GoVersion string `json:"go_version"`
}

type nsjailInfo struct {
	Path    string `json:"path"`
	Version string `json:"version"`
}

type languageInfo struct {
	ID               string          `json:"id"`
	Name             string          `json:"name"`
	Version          string          `json:"version,omitempty"`
	DefaultRunLimits registry.Limits `json:"default_run_limits"`
}

type limitsInfo struct {
	MaxSourceBytes    int   `json:"max_source_bytes"`
	MaxTests          int   `json:"max_tests"`
	MaxConcurrentJobs int   `json:"max_concurrent_jobs"`
	MaxRequestBytes   int64 `json:"max_request_bytes"`
	MaxOutputBytes    int64 `json:"max_output_bytes"`
}

type statsInfo struct {
	InFlightJobs         int64     `json:"in_flight_jobs"`
	JobsTotal            int64     `json:"jobs_total"`
	JobsFailedInternal   int64     `json:"jobs_failed_internal"`
	LastInternalErrorAt  time.Time `json:"last_internal_error_at,omitempty"`
	DiskFreeBytesJailDir uint64    `json:"disk_free_bytes_jail_dir"`
}

type infoResponse struct {
	BuildInfo buildInfo      `json:"build_info"`
	Nsjail    nsjailInfo     `json:"nsjail"`
	Languages []languageInfo `json:"languages"`
	Limits    limitsInfo     `json:"limits"`
	Stats     statsInfo      `json:"stats"`
}

// Info returns the /info handler. Always 200.
func Info(reg *registry.Registry, st *stats.Stats, p *runner.Prober, cfg config.Config) server.Handler {
	commit := readCommit()

	return func(w http.ResponseWriter, r *http.Request) {
		snap := p.Snapshot(r.Context())

		langs := make([]languageInfo, 0, len(reg.All()))
		for _, lang := range reg.All() {
			li := languageInfo{
				ID:               lang.ID,
				Name:             lang.Name,
				DefaultRunLimits: lang.Run.Limits,
			}
			if ps, ok := snap.Languages[lang.ID]; ok {
				li.Version = ps.Version
			}
			langs = append(langs, li)
		}

		ss := st.Snapshot()
		resp := infoResponse{
			BuildInfo: buildInfo{
				Version:   Version,
				Commit:    commit,
				GoVersion: runtime.Version(),
			},
			Nsjail: nsjailInfo{
				Path:    cfg.NsjailBin,
				Version: snap.Nsjail.Version,
			},
			Languages: langs,
			Limits: limitsInfo{
				MaxSourceBytes:    cfg.MaxSourceBytes,
				MaxTests:          cfg.MaxTests,
				MaxConcurrentJobs: cfg.MaxConcurrent,
				MaxRequestBytes:   cfg.MaxRequestBytes,
				MaxOutputBytes:    cfg.MaxOutputBytes,
			},
			Stats: statsInfo{
				InFlightJobs:         ss.InFlight,
				JobsTotal:            ss.JobsTotal,
				JobsFailedInternal:   ss.JobsFailedInternal,
				LastInternalErrorAt:  ss.LastErrorAt,
				DiskFreeBytesJailDir: ss.DiskFreeBytes,
			},
		}
		server.WriteJSON(w, http.StatusOK, resp)
	}
}

func readCommit() string {
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return ""
	}
	for _, s := range bi.Settings {
		if s.Key == "vcs.revision" {
			if len(s.Value) >= 7 {
				return s.Value[:7]
			}
			return s.Value
		}
	}
	return ""
}
