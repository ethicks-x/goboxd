package registry

// Limits holds resource constraints for a build or run step.
type Limits struct {
	WallTimeS    int `yaml:"wall_time_s"`
	MemoryKB     int `yaml:"memory_kb"`
	MaxProcesses int `yaml:"max_processes"`
}

// CommandSpec describes how to invoke the build or run command for a language.
type CommandSpec struct {
	Cmd           string   `yaml:"cmd"`
	Args          []string `yaml:"args"`
	Limits        Limits   `yaml:"limits"`
	FlagAllowlist []string `yaml:"flag_allowlist"`
}

// Language describes a single registered language.
// Build is nil for interpreted languages (no compilation step).
type Language struct {
	ID             string            `yaml:"id"`
	Name           string            `yaml:"name"`
	SourceFilename string            `yaml:"source_filename"`
	Artifact       string            `yaml:"artifact"`
	SmokeCmd       []string          `yaml:"smoke_cmd"`
	// Env holds extra environment variables injected into both the build and
	// run jails (e.g. GOROOT, LD_LIBRARY_PATH). Toolchains that derive paths
	// from /proc/self/exe need these set explicitly, since the jail runs with
	// --disable_proc.
	Env map[string]string `yaml:"env"`
	// Mounts holds extra host paths bind-mounted read-only into the jail (e.g.
	// Java's /etc/java-17-openjdk). Paths absent on the image are skipped.
	Mounts []string     `yaml:"mounts"`
	Build  *CommandSpec `yaml:"build"`
	Run    CommandSpec  `yaml:"run"`
}
