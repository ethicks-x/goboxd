package config

import (
	"os"
	"runtime"
	"strconv"
	"time"

	"gopkg.in/yaml.v3"
)

// Limits holds resource constraints that can appear at the language or request level.
type Limits struct {
	WallTimeS   int `yaml:"wall_time_s"`
	MemoryKB    int `yaml:"memory_kb"`
	MaxProcesses int `yaml:"max_processes"`
}

// Config is the top-level server configuration.
type Config struct {
	Port          int    `yaml:"port"`
	NsjailBin     string `yaml:"nsjail_bin"`
	JailDir       string `yaml:"jail_dir"`
	LanguagesFile string `yaml:"languages_file"`
	MaxConcurrent int    `yaml:"max_concurrent"`
	SandboxBackend string `yaml:"sandbox_backend"`

	// Global output cap applied to every sandbox run (build + test).
	MaxOutputBytes int64 `yaml:"max_output_bytes"`
	// Hard limit on POST /run body size.
	MaxRequestBytes int64 `yaml:"max_request_bytes"`
	// Hard limit on source code bytes inside the request.
	MaxSourceBytes int `yaml:"max_source_bytes"`
	// Hard limit on number of test cases per request.
	MaxTests int `yaml:"max_tests"`

	// Readyz smoke-probe cache TTL.
	ReadyzCacheTTL time.Duration `yaml:"-"`
	ReadyzCacheTTLS int `yaml:"readyz_cache_ttl_s"`
}

func defaults() Config {
	return Config{
		Port:            8080,
		NsjailBin:       "/usr/sbin/nsjail",
		JailDir:         "/tmp/goboxd-jails",
		LanguagesFile:   "/configs/languages.yaml",
		MaxConcurrent:   0, // 0 → runtime.NumCPU() at startup
		SandboxBackend:  "nsjail",
		MaxOutputBytes:  1 << 20, // 1 MiB
		MaxRequestBytes: 4 << 20, // 4 MiB
		MaxSourceBytes:  65536,
		MaxTests:        50,
		ReadyzCacheTTLS: 30,
	}
}

// Load reads config.yaml at path, then applies GOBOXD_* environment overrides.
// If path is empty, only defaults + env are used.
func Load(path string) Config {
	cfg := defaults()

	if path != "" {
		if data, err := os.ReadFile(path); err == nil {
			_ = yaml.Unmarshal(data, &cfg)
		}
	}

	applyEnv(&cfg)

	if cfg.MaxConcurrent == 0 {
		cfg.MaxConcurrent = runtime.NumCPU()
	}
	cfg.ReadyzCacheTTL = time.Duration(cfg.ReadyzCacheTTLS) * time.Second

	return cfg
}

func applyEnv(cfg *Config) {
	if v := os.Getenv("GOBOXD_PORT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.Port = n
		}
	}
	if v := os.Getenv("GOBOXD_NSJAIL_BIN"); v != "" {
		cfg.NsjailBin = v
	}
	if v := os.Getenv("GOBOXD_JAIL_DIR"); v != "" {
		cfg.JailDir = v
	}
	if v := os.Getenv("GOBOXD_LANGUAGES_FILE"); v != "" {
		cfg.LanguagesFile = v
	}
	if v := os.Getenv("GOBOXD_MAX_CONCURRENT"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			cfg.MaxConcurrent = n
		}
	}
	if v := os.Getenv("GOBOXD_SANDBOX_BACKEND"); v != "" {
		cfg.SandboxBackend = v
	}
	if v := os.Getenv("GOBOXD_MAX_OUTPUT_BYTES"); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			cfg.MaxOutputBytes = n
		}
	}
}
