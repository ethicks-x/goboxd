# syntax=docker/dockerfile:1.7

ARG GO_VERSION=1.23
ARG DEBIAN_VERSION=bookworm
ARG NSJAIL_VERSION=3.4

# ---- Build nsjail from source ----
FROM debian:${DEBIAN_VERSION}-slim AS nsjail-builder
ARG NSJAIL_VERSION
ENV NSJAIL_VERSION=${NSJAIL_VERSION}
COPY scripts /opt/scripts
RUN /opt/scripts/install.sh system nsjail

# ---- Builder / dev image (Go + linters + nsjail + language toolchains) ----
FROM golang:${GO_VERSION}-${DEBIAN_VERSION} AS builder
COPY scripts /opt/scripts
COPY --from=nsjail-builder /usr/local/bin/nsjail /usr/local/bin/nsjail
RUN /opt/scripts/install.sh nsjail-runtime langs
RUN go install github.com/golangci/golangci-lint/cmd/golangci-lint@v1.64.8 \
    && go install github.com/air-verse/air@v1.61.7
WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/goboxd ./cmd/goboxd

# ---- Runtime image ----
FROM debian:${DEBIAN_VERSION}-slim AS runtime
COPY scripts /opt/scripts
COPY --from=nsjail-builder /usr/local/bin/nsjail /usr/local/bin/nsjail
RUN /opt/scripts/install.sh all \
    && rm -rf /opt/scripts
COPY --from=builder /out/goboxd /usr/local/bin/goboxd
COPY configs/      /configs/
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/goboxd"]
