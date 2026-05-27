package unit

import (
	"errors"
	"strings"
	"testing"

	"github.com/ethicks-x/goboxd/internal/validation"
)

func TestValidateFilename(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want error
	}{
		{"plain", "solution.py", nil},
		{"plain_cpp", "Solution.java", nil},
		{"empty", "", validation.ErrFilenameEmpty},
		{"leading_dot", ".hidden", validation.ErrFilenameLeadingDot},
		{"leading_dot_dotfile", ".bashrc", validation.ErrFilenameLeadingDot},
		{"forward_slash", "foo/bar.py", validation.ErrFilenamePathSep},
		{"absolute", "/etc/passwd", validation.ErrFilenamePathSep},
		{"backslash", "foo\\bar.py", validation.ErrFilenamePathSep},
		{"dotdot_anywhere", "a..b.py", validation.ErrFilenameDotDot},
		{"dotdot_traversal", "..", validation.ErrFilenameLeadingDot},
		{"too_long", strings.Repeat("a", 256) + ".py", validation.ErrFilenameTooLong},
		{"max_length_ok", strings.Repeat("a", 255), nil},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := validation.ValidateFilename(tc.in)
			if !errors.Is(got, tc.want) {
				t.Fatalf("ValidateFilename(%q) = %v, want %v", tc.in, got, tc.want)
			}
		})
	}
}
