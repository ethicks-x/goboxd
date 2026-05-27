package runner

import (
	"context"
	"strings"

	"github.com/ethicks-x/goboxd/internal/config"
	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/sandbox"
	"github.com/ethicks-x/goboxd/internal/validation"
)

// StatsSink receives lifecycle signals from the runner. The stats package
// satisfies it; tests may pass NopStats{} to skip counting.
type StatsSink interface {
	JobStarted()
	JobFinished()
	InternalError()
}

// NopStats is a StatsSink that discards every event.
type NopStats struct{}

func (NopStats) JobStarted()    {}
func (NopStats) JobFinished()   {}
func (NopStats) InternalError() {}

// RunRequest is the decoded POST /run body. The handler builds it; the
// runner does not touch JSON.
type RunRequest struct {
	Language         string
	Source           string
	SourceFilename   string
	ArtifactFilename string
	Build            StepRequest
	Run              StepRequest
	Tests            []TestCase
}

// StepRequest carries per-request overrides for a build or run step.
type StepRequest struct {
	Limits registry.Limits
	Flags  []string
}

// TestCase is one entry in the request's tests array.
type TestCase struct {
	Stdin          string
	ExpectedStdout string
}

// RunResponse is the structured result returned for any non-4xx request.
type RunResponse struct {
	Status string         `json:"status"`
	Build  BuildOutcome   `json:"build"`
	Tests  []TestOutcome  `json:"tests"`
}

// BuildOutcome mirrors response.build in the spec.
type BuildOutcome struct {
	Status     string `json:"status"`
	Stdout     string `json:"stdout"`
	Stderr     string `json:"stderr"`
	DurationMS int64  `json:"duration_ms"`
}

// TestOutcome mirrors one entry of response.tests.
type TestOutcome struct {
	Status       string `json:"status"`
	Stdout       string `json:"stdout"`
	Stderr       string `json:"stderr"`
	DurationMS   int64  `json:"duration_ms"`
	MemoryPeakKB int64  `json:"memory_peak_kb"`
}

// Runner orchestrates a single /run request: workdir setup, build, per-test
// execution, status roll-up, teardown. It is goroutine-safe and intended to
// be shared by all handlers.
type Runner struct {
	reg   *registry.Registry
	sbox  sandbox.Sandbox
	sem   *Semaphore
	stats StatsSink
	cfg   config.Config
}

// New wires a Runner. All dependencies are required.
func New(reg *registry.Registry, sbox sandbox.Sandbox, sem *Semaphore, st StatsSink, cfg config.Config) *Runner {
	return &Runner{reg: reg, sbox: sbox, sem: sem, stats: st, cfg: cfg}
}

// Run executes the request and returns either a structured response or an
// error. An error means the request itself was rejected (caller maps to
// 4xx/5xx); a non-nil response with status="internal_error" means the
// pipeline ran but hit a sandbox-side failure (200 with structured payload,
// per spec §04).
func (r *Runner) Run(ctx context.Context, req RunRequest) (RunResponse, error) {
	lang, ok := r.reg.Lookup(req.Language)
	if !ok {
		return RunResponse{}, ErrUnknownLanguage{ID: req.Language}
	}

	sourceFilename := req.SourceFilename
	if sourceFilename == "" {
		sourceFilename = lang.SourceFilename
	}
	if err := validation.ValidateFilename(sourceFilename); err != nil {
		return RunResponse{}, ErrInvalidFilename{Field: "source_filename", Reason: err.Error()}
	}

	artifact := req.ArtifactFilename
	if artifact == "" {
		artifact = lang.Artifact
	}
	if artifact != "" {
		if err := validation.ValidateFilename(artifact); err != nil {
			return RunResponse{}, ErrInvalidFilename{Field: "artifact_filename", Reason: err.Error()}
		}
	}

	var buildFlags []string
	if lang.Build != nil {
		filtered, err := validation.FilterFlags(req.Build.Flags, lang.Build.FlagAllowlist)
		if err != nil {
			return RunResponse{}, ErrDisallowedFlag{Step: "build", Reason: err.Error()}
		}
		buildFlags = filtered
	} else if len(req.Build.Flags) > 0 {
		return RunResponse{}, ErrDisallowedFlag{Step: "build", Reason: "language has no build step"}
	}
	runFlags, err := validation.FilterFlags(req.Run.Flags, lang.Run.FlagAllowlist)
	if err != nil {
		return RunResponse{}, ErrDisallowedFlag{Step: "run", Reason: err.Error()}
	}

	if err := r.sem.Acquire(ctx); err != nil {
		return RunResponse{}, err
	}
	defer r.sem.Release()

	r.stats.JobStarted()
	defer r.stats.JobFinished()

	workDir, cleanup, err := SafeWorkDir(r.cfg.JailDir)
	if err != nil {
		r.stats.InternalError()
		return internalErrorResponse(len(req.Tests)), nil
	}
	defer cleanup()

	if err := WriteSource(workDir, sourceFilename, req.Source); err != nil {
		r.stats.InternalError()
		return internalErrorResponse(len(req.Tests)), nil
	}

	resp := RunResponse{Tests: make([]TestOutcome, 0, len(req.Tests))}

	if lang.Build != nil {
		buildLimits := validation.MergeLimits(req.Build.Limits, lang.Build.Limits)
		bj := sandbox.BuildJob{
			WorkDir:  workDir,
			Language: &lang,
			Source:   req.Source,
			Filename: sourceFilename,
			Artifact: artifact,
			Flags:    buildFlags,
			Limits:   buildLimits,
		}
		br := r.sbox.Build(ctx, bj)
		resp.Build = BuildOutcome{
			Stdout:     br.Stdout,
			Stderr:     br.Stderr,
			DurationMS: br.Duration.Milliseconds(),
		}
		switch {
		case br.InternalErr != nil:
			resp.Build.Status = BuildInternalError
			r.stats.InternalError()
		case !br.OK:
			resp.Build.Status = BuildFailed
		default:
			resp.Build.Status = BuildOK
		}
	} else {
		resp.Build.Status = BuildOK
	}

	if resp.Build.Status != BuildOK {
		for range req.Tests {
			resp.Tests = append(resp.Tests, TestOutcome{Status: TestNotExecuted})
		}
		resp.Status = RollUp(resp.Build.Status, MarkAllNotExecuted(len(req.Tests)))
		return resp, nil
	}

	runArtifact := artifact
	if runArtifact == "" {
		runArtifact = sourceFilename
	}
	runLimits := validation.MergeLimits(req.Run.Limits, lang.Run.Limits)

	statuses := make([]string, 0, len(req.Tests))
	for _, tc := range req.Tests {
		rj := sandbox.RunJob{
			WorkDir:  workDir,
			Language: &lang,
			Artifact: runArtifact,
			Stdin:    tc.Stdin,
			Flags:    runFlags,
			Limits:   runLimits,
		}
		tr := r.sbox.Run(ctx, rj)
		status := tr.Status
		if tr.InternalErr != nil {
			status = TestInternalError
			r.stats.InternalError()
		} else if status == TestAccepted {
			status = compareOutput(tr.Stdout, tc.ExpectedStdout)
		}
		resp.Tests = append(resp.Tests, TestOutcome{
			Status:       status,
			Stdout:       tr.Stdout,
			Stderr:       tr.Stderr,
			DurationMS:   tr.Duration.Milliseconds(),
			MemoryPeakKB: tr.MemoryPeakKB,
		})
		statuses = append(statuses, status)
	}

	resp.Status = RollUp(resp.Build.Status, statuses)
	return resp, nil
}

// compareOutput applies the spec's two-tier comparison: exact match →
// accepted; whitespace-normalized match → output_whitespace_mismatch;
// otherwise wrong_output.
func compareOutput(got, want string) string {
	if got == want {
		return TestAccepted
	}
	if normalizeWS(got) == normalizeWS(want) {
		return TestWSMismatch
	}
	return TestWrongOutput
}

func normalizeWS(s string) string {
	return strings.Join(strings.Fields(s), " ")
}

func internalErrorResponse(numTests int) RunResponse {
	tests := make([]TestOutcome, numTests)
	for i := range tests {
		tests[i] = TestOutcome{Status: TestNotExecuted}
	}
	return RunResponse{
		Status: TopInternalError,
		Build:  BuildOutcome{Status: BuildInternalError},
		Tests:  tests,
	}
}
