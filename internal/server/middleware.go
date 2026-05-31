package server

import (
	"log"
	"net/http"
	"strconv"
	"strings"
)

type Middleware func(Handler) Handler

func Chain(h Handler, middleware ...Middleware) Handler {
	for i := len(middleware) - 1; i >= 0; i-- {
		h = middleware[i](h)
	}
	return h
}

func (s *Server) ApplyMiddleware(h Handler) Handler {
	if len(s.middlewares) == 0 {
		return h
	}
	return Chain(h, s.middlewares...)
}

func (s *Server) Use(middleware ...Middleware) {
	s.middlewares = append(s.middlewares, middleware...)
}

// Some example middleware functions

func LoggingMiddleware(next Handler) Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		log.Println(StyledRequest(r.Method, r.URL.Path))
		next(w, r)
	}
}

func AuthMiddleware(next Handler) Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		// Check for auth token (this is a very simplistic example)
		if r.Header.Get("Authorization") == "" {
			http.Error(w, "Unauthorized", http.StatusUnauthorized)
			return
		}
		next(w, r)
	}
}

// CORSOptions configures CORSMiddleware.
type CORSOptions struct {
	AllowedOrigins   []string
	AllowedMethods   []string
	AllowedHeaders   []string
	AllowCredentials bool
	MaxAgeS          int
}

// allowOrigin returns the value to echo back in Access-Control-Allow-Origin for
// the given request origin, or "" if the origin is not permitted.
func (o CORSOptions) allowOrigin(origin string) string {
	for _, ao := range o.AllowedOrigins {
		if ao == "*" {
			// Wildcard cannot be combined with credentials, so echo the
			// concrete origin when credentials are allowed.
			if o.AllowCredentials {
				return origin
			}
			return "*"
		}
		if strings.EqualFold(ao, origin) {
			return origin
		}
	}
	return ""
}

// CORSMiddleware sets cross-origin headers and short-circuits preflight
// (OPTIONS) requests with a 204.
func CORSMiddleware(opts CORSOptions) Middleware {
	methods := strings.Join(opts.AllowedMethods, ", ")
	headers := strings.Join(opts.AllowedHeaders, ", ")
	return func(next Handler) Handler {
		return func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")
			if allowed := opts.allowOrigin(origin); allowed != "" {
				w.Header().Set("Access-Control-Allow-Origin", allowed)
				if allowed != "*" {
					w.Header().Add("Vary", "Origin")
				}
				if opts.AllowCredentials {
					w.Header().Set("Access-Control-Allow-Credentials", "true")
				}
			}

			if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
				w.Header().Set("Access-Control-Allow-Methods", methods)
				w.Header().Set("Access-Control-Allow-Headers", headers)
				if opts.MaxAgeS > 0 {
					w.Header().Set("Access-Control-Max-Age", strconv.Itoa(opts.MaxAgeS))
				}
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next(w, r)
		}
	}
}

func RecoveryMiddleware(next Handler) Handler {
	return func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if err := recover(); err != nil {
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()
		next(w, r)
	}
}
