package unit

import (
	"testing"

	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/validation"
)

func TestMergeLimits(t *testing.T) {
	defaults := registry.Limits{WallTimeS: 5, MemoryKB: 1024 * 256, MaxProcesses: 64}

	t.Run("zero_request_uses_defaults", func(t *testing.T) {
		got := validation.MergeLimits(registry.Limits{}, defaults)
		if got != defaults {
			t.Fatalf("got %+v, want %+v", got, defaults)
		}
	})

	t.Run("override_all", func(t *testing.T) {
		req := registry.Limits{WallTimeS: 2, MemoryKB: 512, MaxProcesses: 4}
		got := validation.MergeLimits(req, defaults)
		if got != req {
			t.Fatalf("got %+v, want %+v", got, req)
		}
	})

	t.Run("partial_override", func(t *testing.T) {
		req := registry.Limits{WallTimeS: 2}
		got := validation.MergeLimits(req, defaults)
		want := registry.Limits{WallTimeS: 2, MemoryKB: defaults.MemoryKB, MaxProcesses: defaults.MaxProcesses}
		if got != want {
			t.Fatalf("got %+v, want %+v", got, want)
		}
	})

	t.Run("negative_treated_as_unset", func(t *testing.T) {
		req := registry.Limits{WallTimeS: -1, MemoryKB: -1, MaxProcesses: -1}
		got := validation.MergeLimits(req, defaults)
		if got != defaults {
			t.Fatalf("got %+v, want %+v", got, defaults)
		}
	})
}
