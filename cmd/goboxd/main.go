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
	"github.com/ethicks-x/goboxd/internal/registry"
	"github.com/ethicks-x/goboxd/internal/runner"
	"github.com/ethicks-x/goboxd/internal/sandbox"
	"github.com/ethicks-x/goboxd/internal/sandbox/mock"
	"github.com/ethicks-x/goboxd/internal/sandbox/nsjail"
	"github.com/ethicks-x/goboxd/internal/server"
	"github.com/ethicks-x/goboxd/internal/stats"
)

func main() {
	log.SetFlags(0)

	configPath := os.Getenv("GOBOXD_CONFIG")
	if configPath == "" {
		configPath = "/configs/config.yaml"
	}
	cfg := config.Load(configPath)

	reg := registry.MustLoad(cfg.LanguagesFile)

	var sbox sandbox.Sandbox
	switch cfg.SandboxBackend {
	case "mock":
		sbox = mock.New(cfg.MaxOutputBytes)
	default:
		sbox = nsjail.New(cfg.NsjailBin, cfg.JailDir, cfg.MaxOutputBytes)
	}

	for _, err := range runner.StartupSweep(cfg.JailDir, 10*time.Minute) {
		log.Printf("startup sweep: %v", err)
	}

	st := stats.New(cfg.JailDir)
	sem := runner.NewSemaphore(cfg.MaxConcurrent)
	r := runner.New(reg, sbox, sem, st, cfg)
	prober := runner.NewProber(cfg.NsjailBin, reg, cfg.ReadyzCacheTTL)

	s := server.NewServer(cfg.Port)
	s.Use(server.LoggingMiddleware)
	s.Use(server.RecoveryMiddleware)

	s.Router.GET("/", handlers.HomeHandler)
	s.Router.GET("/healthz", handlers.Health())
	s.Router.GET("/readyz", handlers.Readyz(prober))
	s.Router.GET("/info", handlers.Info(reg, st, prober, cfg))
	s.Router.POST("/run", handlers.Run(r, cfg))
	s.Router.NotFound(handlers.NotFoundHandler)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		if err := s.Run(); err != nil {
			log.Fatalf("Error starting server: %v", err)
		}
	}()

	log.Println(server.StyledServerRunning("http://localhost:" + strconv.Itoa(cfg.Port)))

	<-stop

	log.Println(server.StyledServerStopping())

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := s.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println(server.StyledServerStopped())
}
