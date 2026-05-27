package sandbox

import (
	"context"
	"time"

	"github.com/ethicks-x/goboxd/internal/registry"
)

// BuildJob describes a compilation step.
type BuildJob struct {
	WorkDir  string
	Language *registry.Language
	Source   string // source file content
	Filename string // source filename within WorkDir
	Artifact string // artifact filename (empty for interpreted languages)
	Flags    []string
	Limits   registry.Limits
}

// RunJob describes a single test execution.
type RunJob struct {
	WorkDir  string
	Language *registry.Language
	Artifact string // artifact filename; for interpreted langs, same as source filename
	Stdin    string
	Flags    []string
	Limits   registry.Limits
}

// BuildResult is the outcome of a compile step.
type BuildResult struct {
	OK         bool
	Stdout     string
	Stderr     string
	Duration   time.Duration
	InternalErr error // non-nil means sandbox/infrastructure failure
}

// TestResult is the outcome of a single test run.
type TestResult struct {
	Status      string // see spec §04 test.status vocabulary
	Stdout      string
	Stderr      string
	Duration    time.Duration
	MemoryPeakKB int64
	InternalErr  error
}

// Sandbox runs build and run jobs in isolation.
type Sandbox interface {
	Build(ctx context.Context, job BuildJob) BuildResult
	Run(ctx context.Context, job RunJob) TestResult
}
