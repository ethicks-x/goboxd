package registry

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

// Registry holds all registered languages indexed by id.
type Registry struct {
	byID    map[string]Language
	ordered []Language
}

type registryFile struct {
	Languages []Language `yaml:"languages"`
}

// Load reads a languages YAML file and validates every entry.
func Load(path string) (*Registry, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("registry: read %s: %w", path, err)
	}
	var f registryFile
	if err := yaml.Unmarshal(data, &f); err != nil {
		return nil, fmt.Errorf("registry: parse %s: %w", path, err)
	}
	if len(f.Languages) == 0 {
		return nil, fmt.Errorf("registry: no languages defined in %s", path)
	}
	r := &Registry{
		byID:    make(map[string]Language, len(f.Languages)),
		ordered: make([]Language, 0, len(f.Languages)),
	}
	for _, lang := range f.Languages {
		if err := validateLanguage(lang); err != nil {
			return nil, err
		}
		if _, dup := r.byID[lang.ID]; dup {
			return nil, fmt.Errorf("registry: duplicate language id %q", lang.ID)
		}
		r.byID[lang.ID] = lang
		r.ordered = append(r.ordered, lang)
	}
	return r, nil
}

// MustLoad calls Load and panics on error. Intended for use in main().
func MustLoad(path string) *Registry {
	r, err := Load(path)
	if err != nil {
		panic(err)
	}
	return r
}

// Lookup returns the language with the given id.
func (r *Registry) Lookup(id string) (Language, bool) {
	l, ok := r.byID[id]
	return l, ok
}

// All returns all registered languages in YAML definition order.
func (r *Registry) All() []Language {
	return r.ordered
}

func validateLanguage(l Language) error {
	if l.ID == "" {
		return fmt.Errorf("registry: language entry missing id")
	}
	if l.Name == "" {
		return fmt.Errorf("registry: language %q missing name", l.ID)
	}
	if l.Run.Cmd == "" {
		return fmt.Errorf("registry: language %q missing run.cmd", l.ID)
	}
	if l.Build != nil && l.Build.Cmd == "" {
		return fmt.Errorf("registry: language %q has build section but missing build.cmd", l.ID)
	}
	return nil
}
