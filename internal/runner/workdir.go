package runner

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const workdirPrefix = "job-"

// SafeWorkDir creates a fresh, collision-proof working directory under base.
// The returned cleanup func removes the directory recursively. Callers MUST
// defer it; the runner never relies on the OS to clean these up.
func SafeWorkDir(base string) (dir string, cleanup func(), err error) {
	if err := os.MkdirAll(base, 0o755); err != nil {
		return "", nil, fmt.Errorf("workdir: ensure base %s: %w", base, err)
	}
	dir, err = os.MkdirTemp(base, workdirPrefix)
	if err != nil {
		return "", nil, fmt.Errorf("workdir: mkdtemp in %s: %w", base, err)
	}
	if err := os.Chmod(dir, 0o755); err != nil {
		_ = os.RemoveAll(dir)
		return "", nil, fmt.Errorf("workdir: chmod %s: %w", dir, err)
	}
	cleanup = func() { _ = os.RemoveAll(dir) }
	return dir, cleanup, nil
}

// WriteSource writes src to filepath.Join(dir, filename). The filename must
// already have been validated by validation.ValidateFilename.
func WriteSource(dir, filename, src string) error {
	path := filepath.Join(dir, filename)
	return os.WriteFile(path, []byte(src), 0o644)
}

// StartupSweep deletes any job-* directory under base whose mtime is older
// than maxAge. Intended to be called once at boot to reap orphans left by a
// crash. Errors are returned for the caller to log; sweep continues past
// individual failures.
func StartupSweep(base string, maxAge time.Duration) []error {
	var errs []error
	entries, err := os.ReadDir(base)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return []error{fmt.Errorf("sweep: read %s: %w", base, err)}
	}
	cutoff := time.Now().Add(-maxAge)
	for _, e := range entries {
		if !e.IsDir() || !strings.HasPrefix(e.Name(), workdirPrefix) {
			continue
		}
		info, err := e.Info()
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if info.ModTime().After(cutoff) {
			continue
		}
		path := filepath.Join(base, e.Name())
		if err := os.RemoveAll(path); err != nil {
			errs = append(errs, fmt.Errorf("sweep: remove %s: %w", path, err))
		}
	}
	return errs
}
