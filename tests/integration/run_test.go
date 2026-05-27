//go:build integration

package integration

import (
	"context"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/ethicks-x/goboxd/internal/config"
	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/runner"
	"github.com/ethicks-x/goboxd/internal/sandbox/nsjail"
)

// repoRoot returns the absolute path to the repository root, computed from
// this test file's location (.../tests/integration/run_test.go).
func repoRoot(t *testing.T) string {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine caller file")
	}
	return filepath.Clean(filepath.Join(filepath.Dir(file), "..", ".."))
}

func newRunner(t *testing.T) *runner.Runner {
	t.Helper()

	nsjailBin, err := exec.LookPath("nsjail")
	if err != nil {
		t.Skip("nsjail not available on PATH; skipping integration test")
	}
	probeNsjail(t, nsjailBin)

	root := repoRoot(t)
	reg, err := registry.Load(filepath.Join(root, "configs", "languages.yaml"))
	if err != nil {
		t.Fatalf("load registry: %v", err)
	}

	cfg := config.Config{
		JailDir:         t.TempDir(),
		NsjailBin:       nsjailBin,
		MaxConcurrent:   2,
		MaxOutputBytes:  1 << 20,
		MaxRequestBytes: 4 << 20,
		MaxSourceBytes:  65536,
		MaxTests:        50,
	}

	sbox := nsjail.New(nsjailBin, cfg.JailDir)
	sem := runner.NewSemaphore(cfg.MaxConcurrent)
	return runner.New(reg, sbox, sem, runner.NopStats{}, cfg)
}

// probeNsjail skips the test if nsjail cannot create user namespaces in the
// current environment (e.g. unprivileged container). The probe is a no-op
// command that exits 0 on a working setup.
func probeNsjail(t *testing.T, nsjailBin string) {
	t.Helper()
	out, err := exec.Command(nsjailBin,
		"--mode", "o",
		"--chroot", "/",
		"--disable_proc",
		"--iface_no_lo",
		"--", "/bin/true",
	).CombinedOutput()
	if err != nil {
		t.Skipf("nsjail probe failed (requires privileged container): %v\n%s", err, out)
	}
}

func requireToolchain(t *testing.T, bin string) {
	t.Helper()
	if _, err := exec.LookPath(bin); err != nil {
		t.Skipf("%s not available; skipping", bin)
	}
}

func TestRunPython3HelloWorld(t *testing.T) {
	requireToolchain(t, "python3")
	r := newRunner(t)

	req := runner.RunRequest{
		Language: "py3",
		Source:   "print('hello')",
		Tests: []runner.TestCase{
			{Stdin: "", ExpectedStdout: "hello\n"},
		},
	}

	resp, err := r.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("Run error: %v", err)
	}
	if resp.Status != runner.TopAccepted {
		t.Fatalf("status = %q, want %q; build=%+v tests=%+v",
			resp.Status, runner.TopAccepted, resp.Build, resp.Tests)
	}
	if got := resp.Tests[0].Status; got != runner.TestAccepted {
		t.Fatalf("test[0].status = %q, want accepted", got)
	}
}

func TestRunCppHelloWorld(t *testing.T) {
	requireToolchain(t, "g++")
	r := newRunner(t)

	src := `#include <cstdio>
int main(){ std::printf("hello\n"); return 0; }
`
	req := runner.RunRequest{
		Language: "cpp",
		Source:   src,
		Build:    runner.StepRequest{Flags: []string{"-O2", "-std=c++17"}},
		Tests: []runner.TestCase{
			{Stdin: "", ExpectedStdout: "hello\n"},
		},
	}

	resp, err := r.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("Run error: %v", err)
	}
	if resp.Build.Status != runner.BuildOK {
		t.Fatalf("build status = %q (stderr=%q)", resp.Build.Status, resp.Build.Stderr)
	}
	if resp.Status != runner.TopAccepted {
		t.Fatalf("status = %q, want %q; tests=%+v",
			resp.Status, runner.TopAccepted, resp.Tests)
	}
}

func TestRunPython3WrongOutput(t *testing.T) {
	requireToolchain(t, "python3")
	r := newRunner(t)

	req := runner.RunRequest{
		Language: "py3",
		Source:   "print('hello')",
		Tests: []runner.TestCase{
			{Stdin: "", ExpectedStdout: "goodbye\n"},
		},
	}

	resp, err := r.Run(context.Background(), req)
	if err != nil {
		t.Fatalf("Run error: %v", err)
	}
	if resp.Status != runner.TestWrongOutput {
		t.Fatalf("status = %q, want %q", resp.Status, runner.TestWrongOutput)
	}
}
