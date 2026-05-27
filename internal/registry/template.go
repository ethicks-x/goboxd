package registry

import "strings"

// Expand applies {{key}} substitutions to each element of args using vars.
// The special element "{{flags}}" is replaced by zero or more elements from
// flags (one per entry). All other placeholders are replaced inline.
func Expand(args []string, vars map[string]string, flags []string) []string {
	out := make([]string, 0, len(args)+len(flags))
	for _, arg := range args {
		if arg == "{{flags}}" {
			out = append(out, flags...)
		} else {
			out = append(out, ExpandString(arg, vars))
		}
	}
	return out
}

// ExpandString replaces all {{key}} placeholders in s using vars.
func ExpandString(s string, vars map[string]string) string {
	for k, v := range vars {
		s = strings.ReplaceAll(s, "{{"+k+"}}", v)
	}
	return s
}
