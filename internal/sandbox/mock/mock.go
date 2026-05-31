// Package mock provides a sandbox implementation that runs jobs directly on the
// host without any isolation. It exists for unit and integration tests only —
// never use it in production.
package mock

import (
	"bytes"
	"context"
	"io"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/sandbox"
)

const defaultMaxOutputBytes = 1 << 20 // 1 MiB, used when unconfigured

// MockSandbox runs commands on the host, no isolation.
type MockSandbox struct {
	maxOutputBytes int
}

// New returns a MockSandbox. maxOutputBytes caps each captured stream per run;
// a value <= 0 falls back to defaultMaxOutputBytes.
func New(maxOutputBytes int64) *MockSandbox {
	cap := int(maxOutputBytes)
	if cap <= 0 {
		cap = defaultMaxOutputBytes
	}
	return &MockSandbox{maxOutputBytes: cap}
}

func (m *MockSandbox) Build(ctx context.Context, job sandbox.BuildJob) sandbox.BuildResult {
	if job.Language.Build == nil {
		return sandbox.BuildResult{OK: true}
	}
	spec := job.Language.Build
	argv := expandArgs(spec.Cmd, spec.Args, job.WorkDir, job.Flags, "")
	stdout, stderr, dur, err := runHost(ctx, argv, "", job.WorkDir, m.maxOutputBytes)
	if err != nil {
		return sandbox.BuildResult{OK: false, Stdout: stdout, Stderr: stderr, Duration: dur}
	}
	return sandbox.BuildResult{OK: true, Stdout: stdout, Stderr: stderr, Duration: dur}
}

func (m *MockSandbox) Run(ctx context.Context, job sandbox.RunJob) sandbox.TestResult {
	spec := job.Language.Run
	argv := expandArgs(spec.Cmd, spec.Args, job.WorkDir, job.Flags, job.Artifact)
	stdout, stderr, dur, err := runHost(ctx, argv, job.Stdin, job.WorkDir, m.maxOutputBytes)
	if err != nil {
		return sandbox.TestResult{Status: "runtime_error", Stdout: stdout, Stderr: stderr, Duration: dur}
	}
	return sandbox.TestResult{Status: "accepted", Stdout: stdout, Stderr: stderr, Duration: dur}
}

func expandArgs(cmd string, args []string, workDir string, flags []string, artifact string) []string {
	result := []string{expandOne(cmd, workDir, artifact)}
	for _, a := range args {
		switch a {
		case "{{flags}}":
			result = append(result, flags...)
		default:
			result = append(result, expandOne(a, workDir, artifact))
		}
	}
	return result
}

func expandOne(arg, workDir, artifact string) string {
	arg = strings.ReplaceAll(arg, "{{source}}", filepath.Join(workDir, "solution"))
	if artifact != "" {
		arg = strings.ReplaceAll(arg, "{{artifact}}", filepath.Join(workDir, artifact))
	}
	if strings.HasPrefix(arg, "./") {
		return filepath.Join(workDir, arg[2:])
	}
	return arg
}

func runHost(ctx context.Context, argv []string, stdin, workDir string, maxOutputBytes int) (stdout, stderr string, dur time.Duration, err error) {
	cmd := exec.CommandContext(ctx, argv[0], argv[1:]...)
	cmd.Dir = workDir
	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	var outBuf, errBuf bytes.Buffer
	outLim := &limitedWriter{buf: &outBuf, remaining: maxOutputBytes}
	errLim := &limitedWriter{buf: &errBuf, remaining: maxOutputBytes}
	cmd.Stdout = outLim
	cmd.Stderr = errLim

	start := time.Now()
	err = cmd.Run()
	dur = time.Since(start)

	if outLim.truncated {
		outBuf.WriteString("\n[truncated]")
	}
	if errLim.truncated {
		errBuf.WriteString("\n[truncated]")
	}
	return outBuf.String(), errBuf.String(), dur, err
}

type limitedWriter struct {
	buf       *bytes.Buffer
	remaining int
	truncated bool
}

func (w *limitedWriter) Write(p []byte) (int, error) {
	if w.remaining <= 0 {
		w.truncated = true
		return len(p), nil
	}
	if len(p) > w.remaining {
		w.buf.Write(p[:w.remaining])
		w.remaining = 0
		w.truncated = true
		return len(p), nil
	}
	n, err := w.buf.Write(p)
	w.remaining -= n
	return n, err
}

// SmokeProbe runs a language's smoke_cmd on the host and returns its output.
func SmokeProbe(ctx context.Context, lang *registry.Language) (string, error) {
	if len(lang.SmokeCmd) == 0 {
		return "", nil
	}
	out, err := exec.CommandContext(ctx, lang.SmokeCmd[0], lang.SmokeCmd[1:]...).CombinedOutput()
	return strings.TrimSpace(string(out)), err
}

// IODiscardWriter satisfies io.Writer for cmd.Stdout when output is not needed.
type IODiscardWriter struct{}

func (IODiscardWriter) Write(p []byte) (int, error) { return io.Discard.Write(p) }
