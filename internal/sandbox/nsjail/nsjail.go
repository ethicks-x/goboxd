package nsjail

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/sandbox"
)

const (
	maxOutputBytes  = 1 << 20 // 1 MiB per stream
	truncatedMarker = "\n[truncated]"

	// nsjail's default RLIMIT_NOFILE (32) and RLIMIT_FSIZE (1 MiB) are far too
	// small for real toolchains: the Go compiler exhausts 32 descriptors and
	// emits archives larger than 1 MiB. Real memory is capped per-job via
	// --cgroup_mem_max, so these rlimits exist only to keep the toolchains
	// functional, not as the memory boundary.
	maxOpenFiles = 1024
	maxFsizeMB   = 256
)

// deviceMounts are the /dev nodes bind-mounted into every jail. With a fresh
// tmpfs root (no --chroot) /dev is otherwise empty; the Go build's tool
// invocations need /dev/null, and runtimes seed their RNG from /dev/urandom.
var deviceMounts = []struct {
	path string
	rw   bool
}{
	{"/dev/null", true},
	{"/dev/zero", true},
	{"/dev/urandom", false},
	{"/dev/random", false},
}

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

	args := s.buildArgv(job.WorkDir, job.Language, job.Limits, job.Flags, job.Filename, job.Artifact)
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
func (s *NsjailSandbox) buildArgv(workDir string, lang *registry.Language, limits registry.Limits, flags []string, source, artifact string) []string {
	spec := lang.Build
	jail := s.baseJailArgs(workDir, limits, lang.Env, lang.Mounts)
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
	jail := s.baseJailArgs(workDir, limits, lang.Env, lang.Mounts)
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

func (s *NsjailSandbox) baseJailArgs(workDir string, limits registry.Limits, extraEnv map[string]string, extraMounts []string) []string {
	// No --chroot: nsjail builds a fresh tmpfs as the jail root and we bind in
	// only what the toolchains need. Chrooting to "/" would expose the whole
	// container filesystem (/home, /root, /etc/shadow, and other requests'
	// work directories) to untrusted code.
	args := []string{
		s.nsjailBin,
		"--mode", "o",
		"--log_fd", "3",
		"--disable_proc",
		"--iface_no_lo",
		"--detect_cgroupv2",
		"--rlimit_nofile", strconv.Itoa(maxOpenFiles),
		"--rlimit_fsize", strconv.Itoa(maxFsizeMB),
		// Virtual address space is left unbounded: the JVM and V8 reserve
		// multi-GB regions at startup that never become resident. Real memory
		// is capped by --cgroup_mem_max below.
		"--rlimit_as", "max",
	}
	for _, p := range systemMountsRO {
		if _, err := os.Stat(p); err == nil {
			args = append(args, "--bindmount_ro", p)
		}
	}
	for _, d := range deviceMounts {
		if _, err := os.Stat(d.path); err != nil {
			continue
		}
		if d.rw {
			args = append(args, "--bindmount", d.path)
		} else {
			args = append(args, "--bindmount_ro", d.path)
		}
	}
	// Per-language read-only mounts (e.g. Java's /etc/java-17-openjdk).
	for _, p := range extraMounts {
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
	// Per-language env (e.g. GOROOT, LD_LIBRARY_PATH), sorted for a stable argv.
	for _, k := range sortedKeys(extraEnv) {
		args = append(args, "--env", k+"="+extraEnv[k])
	}
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

// sortedKeys returns the keys of m in lexical order, so env flags land in a
// deterministic order in the argv.
func sortedKeys(m map[string]string) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}

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
