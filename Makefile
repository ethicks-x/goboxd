.PHONY: build run dev test integration lint

COMPOSE ?= docker compose
TOOLS   := $(COMPOSE) --profile tools run --rm tools

build:
	$(COMPOSE) build goboxd

run:
	$(COMPOSE) up goboxd

dev:
	$(COMPOSE) up dev

test:
	$(TOOLS) go test ./...

integration:
	$(TOOLS) go test -tags=integration ./tests/...

lint:
	$(TOOLS) golangci-lint run ./...
