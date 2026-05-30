package nsjail

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/sandbox"
)

const (
	maxOutputBytes = 1 << 20 // 1 MiB per stream
	truncatedMarker = "\n[truncated]"
)

// NsjailSandbox runs jobs inside nsjail.
type NsjailSandbox struct {
	nsjailBin string
	jailDir   string
}

// New returns an NsjailSandbox.
func New(nsjailBin, jailDir string) *NsjailSandbox {
	return &NsjailSandbox{nsjailBin: nsjailBin, jailDir: jailDir}
}

func (s *NsjailSandbox) Build(ctx context.Context, job sandbox.BuildJob) sandbox.BuildResult {
	if job.Language.Build == nil {
		return sandbox.BuildResult{OK: true}
	}

	args := s.buildArgv(job.WorkDir, job.Language.Build, job.Limits, job.Flags, job.Filename, job.Artifact)
	stdout, stderr, dur, err := s.runCmd(ctx, args, "", job.WorkDir)
	if err != nil {
		if isInfraErr(err) {
			return sandbox.BuildResult{Stdout: stdout, Stderr: stderr, Duration: dur, InternalErr: err}
		}
		return sandbox.BuildResult{OK: false, Stdout: stdout, Stderr: stderr, Duration: dur}
	}
	return sandbox.BuildResult{OK: true, Stdout: stdout, Stderr: stderr, Duration: dur}
}

func (s *NsjailSandbox) Run(ctx context.Context, job sandbox.RunJob) sandbox.TestResult {
	args := s.runArgv(job.WorkDir, job.Language, job.Limits, job.Flags, job.Artifact)
	stdout, stderr, dur, err := s.runCmd(ctx, args, job.Stdin, job.WorkDir)
	if err != nil {
		st := exitStatus(err, stdout, stderr)
		return sandbox.TestResult{Status: st, Stdout: stdout, Stderr: stderr, Duration: dur}
	}
	return sandbox.TestResult{Status: "accepted", Stdout: stdout, Stderr: stderr, Duration: dur}
}

// buildArgv constructs the nsjail + compiler argv for a build step.
func (s *NsjailSandbox) buildArgv(workDir string, spec *registry.CommandSpec, limits registry.Limits, flags []string, source, artifact string) []string {
	jail := s.baseJailArgs(workDir, limits)
	jail = append(jail, "--", expandTemplate(spec.Cmd, source, artifact))
	for _, a := range spec.Args {
		switch a {
		case "{{flags}}":
			jail = append(jail, flags...)
		default:
			jail = append(jail, expandTemplate(a, source, artifact))
		}
	}
	return jail
}

// runArgv constructs the nsjail + runtime argv for a run step.
func (s *NsjailSandbox) runArgv(workDir string, lang *registry.Language, limits registry.Limits, flags []string, artifact string) []string {
	spec := lang.Run
	jail := s.baseJailArgs(workDir, limits)
	cmd := expandTemplate(spec.Cmd, artifact, artifact)
	if !strings.HasPrefix(cmd, "/") {
		cmd = "./" + cmd
	}
	jail = append(jail, "--", cmd)
	for _, a := range spec.Args {
		switch a {
		case "{{flags}}":
			jail = append(jail, flags...)
		default:
			jail = append(jail, expandTemplate(a, artifact, artifact))
		}
	}
	return jail
}

// systemMountsRO are host paths bind-mounted read-only into every jail. They
// give the toolchains their interpreters, shared libraries, and loader cache
// without exposing the rest of the host filesystem (notably /home, /root, and
// /etc/shadow, which must stay invisible). Paths absent on a given image are
// skipped, since nsjail aborts when a bindmount source does not exist.
var systemMountsRO = []string{
	"/usr",
	"/bin",
	"/sbin",
	"/lib",
	"/lib64",
	"/etc/ld.so.cache",  // loader cache; without it glibc cannot locate libc.so.6
	"/etc/alternatives", // /usr/bin/{java,javac,...} are symlinks routed through here
	"/etc/ssl",          // TLS roots, for languages linked against OpenSSL
}

func (s *NsjailSandbox) baseJailArgs(workDir string, limits registry.Limits) []string {
	// No --chroot: nsjail mounts a fresh tmpfs as the jail root and we bind in
	// only what the toolchains need. Chrooting to "/" would expose the whole
	// container filesystem to untrusted code.
	args := []string{
		s.nsjailBin,
		"--mode", "o",
		"--log_fd", "3",
		"--disable_proc",
		"--iface_no_lo",
		"--detect_cgroupv2",
	}
	for _, p := range systemMountsRO {
		if _, err := os.Stat(p); err == nil {
			args = append(args, "--bindmount_ro", p)
		}
	}
	// The per-request work directory is the only writable location in the jail.
	args = append(args,
		"--bindmount", workDir+":"+workDir,
		"--cwd", workDir,
		"--env", "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
		"--env", "HOME="+workDir,
		"--env", "TMPDIR="+workDir,
		"--env", "LANG=C.UTF-8",
	)
	if limits.WallTimeS > 0 {
		args = append(args, "--time_limit", strconv.Itoa(limits.WallTimeS))
	}
	if limits.MemoryKB > 0 {
		// cgroup_mem_max caps actual RSS; rlimit_as would cap virtual address
		// space, which V8/JVM reserve in multi-GB chunks at startup.
		args = append(args, "--cgroup_mem_max", strconv.FormatInt(int64(limits.MemoryKB)*1024, 10))
	}
	if limits.MaxProcesses > 0 {
		args = append(args, "--max_cpus", "1")
		args = append(args, "--cgroup_pids_max", strconv.Itoa(limits.MaxProcesses))
	}
	return args
}

func (s *NsjailSandbox) runCmd(ctx context.Context, argv []string, stdin, workDir string) (stdout, stderr string, dur time.Duration, err error) {
	cmd := exec.CommandContext(ctx, argv[0], argv[1:]...)
	cmd.Dir = workDir

	if stdin != "" {
		cmd.Stdin = strings.NewReader(stdin)
	}

	// Discard nsjail's own log (fd 3) by opening /dev/null — nsjail writes to
	// the fd we named in --log_fd; if it can't open it the run still works.
	devNull, _ := os.Open(os.DevNull)
	if devNull != nil {
		defer devNull.Close()
		cmd.ExtraFiles = []*os.File{devNull} // becomes fd 3
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
		outBuf.WriteString(truncatedMarker)
	}
	if errLim.truncated {
		errBuf.WriteString(truncatedMarker)
	}

	return outBuf.String(), errBuf.String(), dur, err
}

// limitedWriter caps output at n bytes and marks when truncated.
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

// devNullWriter discards everything (used as a no-op placeholder).
type devNullWriter struct{}

func (devNullWriter) Write(p []byte) (int, error) { return len(p), nil }

// expandTemplate substitutes {{source}} and {{artifact}} placeholders with the
// corresponding filenames. Filenames are resolved relative to the workdir (the
// jail's cwd), so callers can pass bare filenames.
func expandTemplate(arg, source, artifact string) string {
	arg = strings.ReplaceAll(arg, "{{source}}", source)
	arg = strings.ReplaceAll(arg, "{{artifact}}", artifact)
	return arg
}

// isInfraErr returns true when the command failed for a sandbox/OS reason
// rather than a user-code reason. We treat exit code 1 as a normal build/run
// failure; other exit codes (125, 126, 127, signal deaths) are infra errors.
func isInfraErr(err error) bool {
	var exitErr *exec.ExitError
	if !isExitError(err, &exitErr) {
		return true // process didn't start
	}
	code := exitErr.ExitCode()
	return code != 1
}

func isExitError(err error, target **exec.ExitError) bool {
	var e *exec.ExitError
	if err == nil {
		return false
	}
	switch v := err.(type) {
	case *exec.ExitError:
		e = v
	default:
		return false
	}
	if target != nil {
		*target = e
	}
	return true
}

func exitStatus(err error, stdout, stderr string) string {
	if err == nil {
		return "accepted"
	}
	var exitErr *exec.ExitError
	if !isExitError(err, &exitErr) {
		return "internal_error"
	}
	code := exitErr.ExitCode()
	switch {
	case code == 137: // SIGKILL — nsjail uses this for time/memory exceeded
		// Distinguish time vs memory: nsjail prints "time limit exceeded" in its log.
		// Without parsing nsjail's log we default to time_exceeded as the common case.
		return "time_exceeded"
	case code > 0:
		return "runtime_error"
	default:
		return "internal_error"
	}
}

// Version runs `nsjail --version` and returns the version string.
func Version(nsjailBin string) (string, error) {
	out, err := exec.Command(nsjailBin, "--version").CombinedOutput()
	if err != nil {
		return "", fmt.Errorf("nsjail --version: %w", err)
	}
	// nsjail --version prints "nsjail version: 3.4" (or similar)
	line := strings.TrimSpace(string(out))
	parts := strings.SplitN(line, ":", 2)
	if len(parts) == 2 {
		return strings.TrimSpace(parts[1]), nil
	}
	return line, nil
}
