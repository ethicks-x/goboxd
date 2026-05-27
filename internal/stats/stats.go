// Package stats holds process-wide counters surfaced through /info.
// All mutators are safe for concurrent use; readers get a Snapshot.
package stats

import (
	"sync/atomic"
	"syscall"
	"time"
)

// Stats tracks lifecycle counters for the runner and disk space for the
// jail directory. Zero value is not usable; call New.
type Stats struct {
	jailDir string

	inFlight           atomic.Int64
	jobsTotal          atomic.Int64
	jobsFailedInternal atomic.Int64
	lastErrorUnixNano  atomic.Int64
}

// Snapshot is a point-in-time view of the counters plus a fresh DiskFree
// reading. Suitable for JSON encoding in /info.
type Snapshot struct {
	InFlight           int64     `json:"in_flight"`
	JobsTotal          int64     `json:"jobs_total"`
	JobsFailedInternal int64     `json:"jobs_failed_internal"`
	LastErrorAt        time.Time `json:"last_error_at,omitempty"`
	DiskFreeBytes      uint64    `json:"disk_free_bytes"`
}

// New returns a Stats bound to jailDir for disk-free queries.
func New(jailDir string) *Stats {
	return &Stats{jailDir: jailDir}
}

// JobStarted increments in-flight and total counters. Pair with JobFinished.
func (s *Stats) JobStarted() {
	s.inFlight.Add(1)
	s.jobsTotal.Add(1)
}

// JobFinished decrements the in-flight counter.
func (s *Stats) JobFinished() {
	s.inFlight.Add(-1)
}

// InternalError records a server-side failure and stamps LastErrorAt.
func (s *Stats) InternalError() {
	s.jobsFailedInternal.Add(1)
	s.lastErrorUnixNano.Store(time.Now().UnixNano())
}

// Snapshot returns the current counters and a fresh disk-free reading.
// Disk-free errors are swallowed; the field is left at zero.
func (s *Stats) Snapshot() Snapshot {
	snap := Snapshot{
		InFlight:           s.inFlight.Load(),
		JobsTotal:          s.jobsTotal.Load(),
		JobsFailedInternal: s.jobsFailedInternal.Load(),
		DiskFreeBytes:      diskFree(s.jailDir),
	}
	if ns := s.lastErrorUnixNano.Load(); ns != 0 {
		snap.LastErrorAt = time.Unix(0, ns).UTC()
	}
	return snap
}

func diskFree(path string) uint64 {
	if path == "" {
		return 0
	}
	var st syscall.Statfs_t
	if err := syscall.Statfs(path, &st); err != nil {
		return 0
	}
	return uint64(st.Bavail) * uint64(st.Bsize)
}
