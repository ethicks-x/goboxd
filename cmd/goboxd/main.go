package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/ethicks-x/goboxd/internal/config"
	"github.com/ethicks-x/goboxd/internal/handlers"
	"github.com/ethicks-x/goboxd/internal/server"
)

func main() {
	log.SetFlags(0)

	configPath := os.Getenv("GOBOXD_CONFIG")
	if configPath == "" {
		configPath = "/configs/config.yaml"
	}
	cfg := config.Load(configPath)

	s := server.NewServer(cfg.Port)

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

	log.Println(server.StyledServerRunning("http://localhost:" + strconv.Itoa(cfg.Port)))

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
