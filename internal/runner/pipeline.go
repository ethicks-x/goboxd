package runner

// Status values are kept as string constants so the runner and handler
// layers cannot disagree on spelling. See docs/goboxd.spec.md §04.
const (
	BuildOK            = "ok"
	BuildFailed        = "failed"
	BuildInternalError = "internal_error"

	TestAccepted      = "accepted"
	TestWrongOutput   = "wrong_output"
	TestWSMismatch    = "output_whitespace_mismatch"
	TestTimeExceeded  = "time_exceeded"
	TestMemoryExceed  = "memory_exceeded"
	TestRuntimeError  = "runtime_error"
	TestNotExecuted   = "not_executed"
	TestInternalError = "internal_error"

	TopAccepted      = "accepted"
	TopBuildFailed   = "build_failed"
	TopInternalError = "internal_error"
)

// RollUp returns the top-level status given the build status and per-test
// statuses, applying the rule from §04: if build did not succeed, top-level
// is build_failed (or internal_error); otherwise it's the first non-accepted
// test status, or "accepted" if every test passed.
func RollUp(buildStatus string, testStatuses []string) string {
	switch buildStatus {
	case BuildOK:
		// fall through
	case BuildInternalError:
		return TopInternalError
	default:
		return TopBuildFailed
	}
	for _, s := range testStatuses {
		if s != TestAccepted {
			return s
		}
	}
	return TopAccepted
}

// MarkAllNotExecuted returns a slice of n entries all set to not_executed,
// used when the build failed so no test ran.
func MarkAllNotExecuted(n int) []string {
	out := make([]string, n)
	for i := range out {
		out[i] = TestNotExecuted
	}
	return out
}
