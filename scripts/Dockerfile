# syntax=docker/dockerfile:1.7
# Build the frontend
FROM node:22-alpine AS frontend
WORKDIR /web
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY web/package.json web/pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm config set store-dir /pnpm/store && \
    pnpm install --frozen-lockfile
COPY web/ .
COPY proto/ /proto
ARG NODE_OPTIONS="--max-old-space-size=1536"
ENV NODE_OPTIONS=$NODE_OPTIONS
RUN pnpm release

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS backend
WORKDIR /backend-build

# Install build dependencies
RUN apk add --no-cache git ca-certificates

# Copy go mod files and download dependencies (cached layer)
COPY go.mod go.sum ./
RUN --mount=type=cache,id=gomod-cache,target=/go/pkg/mod \
    go mod download

# Copy source code and the built frontend
COPY . .
COPY --from=frontend /server/router/frontend/dist ./server/router/frontend/dist

# Build the backend
ARG TARGETOS TARGETARCH VERSION COMMIT
RUN --mount=type=cache,id=gomod-cache,target=/go/pkg/mod \
    --mount=type=cache,id=gobuild-cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build \
    -trimpath \
    -ldflags="-s -w -extldflags '-static'" \
    -tags netgo,osusergo \
    -o memos \
    ./cmd/memos

# Use minimal Alpine with security updates
FROM alpine:3.21 AS monolithic
WORKDIR /usr/local/memos

# Install runtime dependencies and create non-root user in single layer
RUN apk add --no-cache tzdata ca-certificates && \
    addgroup -g 10001 -S nonroot && \
    adduser -u 10001 -S -G nonroot -h /var/opt/memos nonroot && \
    mkdir -p /var/opt/memos && \
    chown -R nonroot:nonroot /var/opt/memos

# Copy binary and entrypoint
COPY --from=backend /backend-build/memos /usr/local/memos/memos
COPY --from=backend --chmod=755 /backend-build/scripts/entrypoint.sh /usr/local/memos/entrypoint.sh

# Switch to non-root user
USER nonroot:nonroot

# Data directory
VOLUME /var/opt/memos

ENV TZ="UTC" \
    MEMOS_MODE="prod" \
    MEMOS_PORT="5230"

EXPOSE 5230

ENTRYPOINT ["/usr/local/memos/entrypoint.sh", "/usr/local/memos/memos"]
