package validation

import (
	"fmt"
	"strings"
)

// FilterFlags checks every entry in requested against allowlist and returns
// the validated slice. Allowlist entries ending with "*" match any flag that
// shares the same prefix (e.g. "-std=*" matches "-std=c++17"). Any flag not
// matched returns an error suitable for a 400 response; no partial result is
// returned on rejection.
func FilterFlags(requested, allowlist []string) ([]string, error) {
	for _, flag := range requested {
		if !flagAllowed(flag, allowlist) {
			return nil, fmt.Errorf("flag %q is not permitted for this language", flag)
		}
	}
	return requested, nil
}

func flagAllowed(flag string, allowlist []string) bool {
	for _, pattern := range allowlist {
		if strings.HasSuffix(pattern, "*") {
			if strings.HasPrefix(flag, pattern[:len(pattern)-1]) {
				return true
			}
		} else if flag == pattern {
			return true
		}
	}
	return false
}
