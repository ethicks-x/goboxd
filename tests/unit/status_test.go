package unit

import (
	"testing"

	"github.com/ethicks-x/goboxd/internal/runner"
)

func TestRollUp(t *testing.T) {
	cases := []struct {
		name   string
		build  string
		tests  []string
		want   string
	}{
		{
			name:  "build_failed_short_circuits",
			build: runner.BuildFailed,
			tests: []string{runner.TestNotExecuted, runner.TestNotExecuted},
			want:  runner.TopBuildFailed,
		},
		{
			name:  "build_internal_error",
			build: runner.BuildInternalError,
			tests: nil,
			want:  runner.TopInternalError,
		},
		{
			name:  "all_accepted",
			build: runner.BuildOK,
			tests: []string{runner.TestAccepted, runner.TestAccepted, runner.TestAccepted},
			want:  runner.TopAccepted,
		},
		{
			name:  "first_non_accepted_wins",
			build: runner.BuildOK,
			tests: []string{runner.TestAccepted, runner.TestWrongOutput, runner.TestTimeExceeded},
			want:  runner.TestWrongOutput,
		},
		{
			name:  "single_failure",
			build: runner.BuildOK,
			tests: []string{runner.TestTimeExceeded},
			want:  runner.TestTimeExceeded,
		},
		{
			name:  "no_tests_with_ok_build",
			build: runner.BuildOK,
			tests: nil,
			want:  runner.TopAccepted,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := runner.RollUp(tc.build, tc.tests)
			if got != tc.want {
				t.Fatalf("RollUp(%q, %v) = %q, want %q", tc.build, tc.tests, got, tc.want)
			}
		})
	}
}

func TestMarkAllNotExecuted(t *testing.T) {
	got := runner.MarkAllNotExecuted(3)
	if len(got) != 3 {
		t.Fatalf("len = %d, want 3", len(got))
	}
	for i, s := range got {
		if s != runner.TestNotExecuted {
			t.Fatalf("got[%d] = %q, want %q", i, s, runner.TestNotExecuted)
		}
	}
	if n := len(runner.MarkAllNotExecuted(0)); n != 0 {
		t.Fatalf("zero-length slice expected, got %d", n)
	}
}
