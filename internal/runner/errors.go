package runner

import "fmt"

// ErrUnknownLanguage is returned when the requested language id is not in
// the registry. The handler maps this to HTTP 400.
type ErrUnknownLanguage struct{ ID string }

func (e ErrUnknownLanguage) Error() string {
	return fmt.Sprintf("unknown language %q", e.ID)
}

// ErrInvalidFilename is returned when source_filename or artifact_filename
// fails validation. The handler maps this to HTTP 400.
type ErrInvalidFilename struct {
	Field  string
	Reason string
}

func (e ErrInvalidFilename) Error() string {
	return fmt.Sprintf("%s: %s", e.Field, e.Reason)
}

// ErrDisallowedFlag is returned when a build or run flag fails the
// per-language allowlist. The handler maps this to HTTP 400.
type ErrDisallowedFlag struct {
	Step   string // "build" or "run"
	Reason string
}

func (e ErrDisallowedFlag) Error() string {
	return fmt.Sprintf("%s flags: %s", e.Step, e.Reason)
}
