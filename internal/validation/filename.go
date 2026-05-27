package validation

import (
	"errors"
	"strings"
)

const maxFilenameLen = 255

var (
	ErrFilenameEmpty      = errors.New("filename must not be empty")
	ErrFilenameTooLong    = errors.New("filename exceeds 255-character limit")
	ErrFilenameLeadingDot = errors.New("filename must not start with a dot")
	ErrFilenamePathSep    = errors.New("filename must be a single path component with no separators")
	ErrFilenameDotDot     = errors.New("filename must not contain ..")
)

// ValidateFilename rejects any filename that could escape the jail directory
// or be used for hidden-file tricks. It accepts only single-component names
// with no path separators, no leading dot, no "..", and a length cap of 255.
func ValidateFilename(s string) error {
	if s == "" {
		return ErrFilenameEmpty
	}
	if len(s) > maxFilenameLen {
		return ErrFilenameTooLong
	}
	if s[0] == '.' {
		return ErrFilenameLeadingDot
	}
	if strings.ContainsAny(s, `/\`) {
		return ErrFilenamePathSep
	}
	if strings.Contains(s, "..") {
		return ErrFilenameDotDot
	}
	return nil
}
