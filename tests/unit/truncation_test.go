package unit

import (
	"context"
	"strings"
	"testing"

	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/sandbox"
	"github.com/ethicks-x/goboxd/internal/sandbox/mock"
)

const oneMiB = 1 << 20

// TestRunOutputTruncation verifies the sandbox caps a single stream at 1 MiB
// and appends the [truncated] marker. Exercises the limited writer used by
// both the nsjail and mock sandbox implementations.
func TestRunOutputTruncation(t *testing.T) {
	lang := &registry.Language{
		ID: "shellprobe",
		Run: registry.CommandSpec{
			Cmd:  "/bin/sh",
			Args: []string{"-c", "yes x | head -c 2000000"},
		},
	}

	sb := mock.New()
	res := sb.Run(context.Background(), sandbox.RunJob{
		WorkDir:  t.TempDir(),
		Language: lang,
	})

	if res.Status != "accepted" {
		t.Fatalf("status = %q, want accepted (stderr=%q)", res.Status, res.Stderr)
	}
	if !strings.HasSuffix(res.Stdout, "[truncated]") {
		t.Fatalf("expected [truncated] suffix, got last 32 bytes: %q", tail(res.Stdout, 32))
	}
	// 1 MiB of captured output plus the marker line.
	if len(res.Stdout) < oneMiB {
		t.Fatalf("captured %d bytes, want at least %d", len(res.Stdout), oneMiB)
	}
	if len(res.Stdout) > oneMiB+64 {
		t.Fatalf("captured %d bytes, expected ~1 MiB + marker", len(res.Stdout))
	}
}

func TestRunOutputBelowCap(t *testing.T) {
	lang := &registry.Language{
		Run: registry.CommandSpec{
			Cmd:  "/bin/sh",
			Args: []string{"-c", "printf hello"},
		},
	}
	res := mock.New().Run(context.Background(), sandbox.RunJob{
		WorkDir:  t.TempDir(),
		Language: lang,
	})
	if res.Stdout != "hello" {
		t.Fatalf("stdout = %q, want %q", res.Stdout, "hello")
	}
	if strings.Contains(res.Stdout, "[truncated]") {
		t.Fatal("did not expect [truncated] marker for short output")
	}
}

func tail(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[len(s)-n:]
}
