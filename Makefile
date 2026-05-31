.PHONY: build run dev test unit integration corpus load security

COMPOSE ?= docker compose
TOOLS   := $(COMPOSE) --profile tools run --rm tools
TEST    ?= ./tests/http-test

build:
	$(COMPOSE) build goboxd dev

run:
	$(COMPOSE) up goboxd

dev:
	$(COMPOSE) up dev

test:
	$(TEST) all

unit:
	$(TEST) unit

integration:
	$(TEST) integration

corpus:
	$(TEST) corpus

load:
	$(TEST) load

security:
	$(TEST) security
