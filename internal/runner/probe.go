package runner

import (
	"context"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/ethicks-x/goboxd/internal/registry"
)

// ProbeStatus is one probe outcome cached in the prober.
type ProbeStatus struct {
	OK      bool   `json:"ok"`
	Version string `json:"version,omitempty"`
	Error   string `json:"error,omitempty"`
}

// ProbeSnapshot is what /readyz and /info read.
type ProbeSnapshot struct {
	Nsjail    ProbeStatus
	Languages map[string]ProbeStatus
}

// Prober runs nsjail + per-language smoke probes and caches the result for
// ttl. Safe for concurrent use.
type Prober struct {
	nsjailBin string
	reg       *registry.Registry
	ttl       time.Duration

	mu     sync.Mutex
	cached ProbeSnapshot
	expiry time.Time
}

// NewProber builds a Prober. Pass cfg.ReadyzCacheTTL as ttl.
func NewProber(nsjailBin string, reg *registry.Registry, ttl time.Duration) *Prober {
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	return &Prober{nsjailBin: nsjailBin, reg: reg, ttl: ttl}
}

// Snapshot returns the cached probe, refreshing if stale.
func (p *Prober) Snapshot(ctx context.Context) ProbeSnapshot {
	p.mu.Lock()
	defer p.mu.Unlock()
	if time.Now().Before(p.expiry) {
		return p.cached
	}
	p.cached = p.run(ctx)
	p.expiry = time.Now().Add(p.ttl)
	return p.cached
}

func (p *Prober) run(ctx context.Context) ProbeSnapshot {
	snap := ProbeSnapshot{
		Nsjail:    probeNsjail(ctx, p.nsjailBin),
		Languages: make(map[string]ProbeStatus, len(p.reg.All())),
	}
	for _, lang := range p.reg.All() {
		snap.Languages[lang.ID] = probeLanguage(ctx, lang)
	}
	return snap
}

func probeNsjail(ctx context.Context, bin string) ProbeStatus {
	if bin == "" {
		return ProbeStatus{OK: false, Error: "nsjail_bin not configured"}
	}
	info, err := os.Stat(bin)
	if err != nil {
		return ProbeStatus{OK: false, Error: err.Error()}
	}
	if info.Mode()&0111 == 0 {
		return ProbeStatus{OK: false, Error: "nsjail not executable"}
	}
	cctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	out, err := exec.CommandContext(cctx, bin, "--version").CombinedOutput()
	if err != nil {
		return ProbeStatus{OK: false, Error: err.Error()}
	}
	return ProbeStatus{OK: true, Version: firstLine(string(out))}
}

func probeLanguage(ctx context.Context, lang registry.Language) ProbeStatus {
	if len(lang.SmokeCmd) == 0 {
		return ProbeStatus{OK: false, Error: "smoke_cmd not configured"}
	}
	cctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	out, err := exec.CommandContext(cctx, lang.SmokeCmd[0], lang.SmokeCmd[1:]...).CombinedOutput()
	if err != nil {
		return ProbeStatus{OK: false, Error: err.Error()}
	}
	return ProbeStatus{OK: true, Version: firstLine(string(out))}
}

func firstLine(s string) string {
	s = strings.TrimSpace(s)
	if i := strings.IndexByte(s, '\n'); i >= 0 {
		return strings.TrimSpace(s[:i])
	}
	return s
}
