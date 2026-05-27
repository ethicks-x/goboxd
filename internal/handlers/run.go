package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"

	"github.com/ethicks-x/goboxd/internal/config"
	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/runner"
	"github.com/ethicks-x/goboxd/internal/server"
)

// runRequestJSON mirrors the POST /run request body in spec §03.
// Decoded into runner.RunRequest before the runner sees it.
type runRequestJSON struct {
	Language         string         `json:"language"`
	Source           string         `json:"source"`
	SourceFilename   string         `json:"source_filename"`
	ArtifactFilename string         `json:"artifact_filename"`
	Build            *stepJSON      `json:"build"`
	Run              *stepJSON      `json:"run"`
	Tests            []testCaseJSON `json:"tests"`
}

type stepJSON struct {
	Limits *limitsJSON `json:"limits"`
	Flags  []string    `json:"flags"`
}

type limitsJSON struct {
	WallTimeS    int `json:"wall_time_s"`
	MemoryKB     int `json:"memory_kb"`
	MaxProcesses int `json:"max_processes"`
}

type testCaseJSON struct {
	Stdin          string `json:"stdin"`
	ExpectedStdout string `json:"expected_stdout"`
}

// Run returns the POST /run handler. It enforces request-size, body, and
// test-count limits before handing off to the runner; the runner owns
// language-specific validation and the sandbox pipeline.
func Run(r *runner.Runner, cfg config.Config) server.Handler {
	maxBody := cfg.MaxRequestBytes
	maxSource := cfg.MaxSourceBytes
	maxTests := cfg.MaxTests

	return func(w http.ResponseWriter, req *http.Request) {
		req.Body = http.MaxBytesReader(w, req.Body, maxBody)
		defer req.Body.Close()

		var body runRequestJSON
		dec := json.NewDecoder(req.Body)
		dec.DisallowUnknownFields()
		if err := dec.Decode(&body); err != nil {
			var maxErr *http.MaxBytesError
			if errors.As(err, &maxErr) {
				server.WriteError(w, http.StatusRequestEntityTooLarge, "request_too_large", "")
				return
			}
			server.WriteError(w, http.StatusBadRequest, "invalid_json", err.Error())
			return
		}
		// Reject trailing JSON content after the top-level value.
		if dec.More() {
			server.WriteError(w, http.StatusBadRequest, "invalid_json", "trailing content after JSON body")
			return
		}

		if body.Language == "" {
			server.WriteError(w, http.StatusBadRequest, "missing_field", "language")
			return
		}
		if body.Source == "" {
			server.WriteError(w, http.StatusBadRequest, "missing_field", "source")
			return
		}
		if maxSource > 0 && len(body.Source) > maxSource {
			server.WriteError(w, http.StatusBadRequest, "source_too_large", "")
			return
		}
		if len(body.Tests) == 0 {
			server.WriteError(w, http.StatusBadRequest, "missing_field", "tests")
			return
		}
		if maxTests > 0 && len(body.Tests) > maxTests {
			server.WriteError(w, http.StatusBadRequest, "too_many_tests", "")
			return
		}

		runReq := runner.RunRequest{
			Language:         body.Language,
			Source:           body.Source,
			SourceFilename:   body.SourceFilename,
			ArtifactFilename: body.ArtifactFilename,
			Build:            stepFromJSON(body.Build),
			Run:              stepFromJSON(body.Run),
			Tests:            make([]runner.TestCase, len(body.Tests)),
		}
		for i, tc := range body.Tests {
			runReq.Tests[i] = runner.TestCase{Stdin: tc.Stdin, ExpectedStdout: tc.ExpectedStdout}
		}

		resp, err := r.Run(req.Context(), runReq)
		if err != nil {
			mapRunnerError(w, err)
			return
		}
		server.WriteJSON(w, http.StatusOK, resp)
	}
}

func stepFromJSON(s *stepJSON) runner.StepRequest {
	if s == nil {
		return runner.StepRequest{}
	}
	out := runner.StepRequest{Flags: s.Flags}
	if s.Limits != nil {
		out.Limits = registry.Limits{
			WallTimeS:    s.Limits.WallTimeS,
			MemoryKB:     s.Limits.MemoryKB,
			MaxProcesses: s.Limits.MaxProcesses,
		}
	}
	return out
}

func mapRunnerError(w http.ResponseWriter, err error) {
	var unknown runner.ErrUnknownLanguage
	var badName runner.ErrInvalidFilename
	var badFlag runner.ErrDisallowedFlag
	switch {
	case errors.As(err, &unknown):
		server.WriteError(w, http.StatusBadRequest, "unknown_language", unknown.Error())
	case errors.As(err, &badName):
		server.WriteError(w, http.StatusBadRequest, "invalid_filename", badName.Error())
	case errors.As(err, &badFlag):
		server.WriteError(w, http.StatusBadRequest, "disallowed_flag", badFlag.Error())
	case errors.Is(err, io.EOF):
		server.WriteError(w, http.StatusBadRequest, "invalid_json", "empty body")
	default:
		server.WriteError(w, http.StatusInternalServerError, "internal_error", err.Error())
	}
}
