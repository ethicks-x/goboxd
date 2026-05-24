package server

import (
	"log"
	"net/http"
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
