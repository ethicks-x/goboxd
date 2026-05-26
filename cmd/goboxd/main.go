package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ethicks-x/goboxd/internal/handlers"
	"github.com/ethicks-x/goboxd/internal/server"
)

func main() {
	log.SetFlags(0)

	s := server.NewServer(8080)

	s.Use(server.LoggingMiddleware)
	s.Use(server.RecoveryMiddleware)

	// Register routes
	s.Router.GET("/", handlers.HomeHandler)
	s.Router.GET("/healthz", handlers.HealthHandler)
	s.Router.POST("/run", handlers.RunHandler)
	s.Router.NotFound(handlers.NotFoundHandler)

	// Set up graceful shutdown
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := s.Run(); err != nil {
			log.Fatalf("Error starting server: %v", err)
		}
	}()

	log.Println(server.StyledServerRunning("http://localhost:8080"))

	//Interrupt signal
	<-stop

	log.Println(server.StyledServerStopping())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println(server.StyledServerStopped())
}
