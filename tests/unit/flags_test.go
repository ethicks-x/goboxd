package unit

import (
	"reflect"
	"testing"

	"github.com/ethicks-x/goboxd/internal/validation"
)

func TestFilterFlags(t *testing.T) {
	allow := []string{"-O0", "-O1", "-O2", "-O3", "-Wall", "-Wextra", "-std=*"}

	t.Run("all_allowed", func(t *testing.T) {
		in := []string{"-O2", "-Wall"}
		got, err := validation.FilterFlags(in, allow)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if !reflect.DeepEqual(got, in) {
			t.Fatalf("got %v, want %v", got, in)
		}
	})

	t.Run("glob_std", func(t *testing.T) {
		got, err := validation.FilterFlags([]string{"-std=c++17", "-std=gnu99"}, allow)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 2 {
			t.Fatalf("got %v", got)
		}
	})

	t.Run("rejected", func(t *testing.T) {
		_, err := validation.FilterFlags([]string{"-O2", "--evil"}, allow)
		if err == nil {
			t.Fatal("expected error for disallowed flag")
		}
	})

	t.Run("rejected_no_partial", func(t *testing.T) {
		got, err := validation.FilterFlags([]string{"-O2", "--evil"}, allow)
		if err == nil {
			t.Fatal("expected error")
		}
		if got != nil {
			t.Fatalf("expected nil slice on rejection, got %v", got)
		}
	})

	t.Run("empty_request", func(t *testing.T) {
		got, err := validation.FilterFlags(nil, allow)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(got) != 0 {
			t.Fatalf("got %v", got)
		}
	})

	t.Run("empty_allowlist_rejects_everything", func(t *testing.T) {
		_, err := validation.FilterFlags([]string{"-O2"}, nil)
		if err == nil {
			t.Fatal("expected error with empty allowlist")
		}
	})

	t.Run("glob_prefix_does_not_match_unrelated", func(t *testing.T) {
		_, err := validation.FilterFlags([]string{"-stdlib=libc++"}, allow)
		if err == nil {
			t.Fatal("expected -stdlib=... to be rejected; only -std=* allowed")
		}
	})
}
