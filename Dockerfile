FROM node:22-alpine AS frontend
WORKDIR /web
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY web/ .
COPY proto/ /proto
ARG NODE_OPTIONS="--max-old-space-size=3072"
ENV NODE_OPTIONS=$NODE_OPTIONS
RUN pnpm release

FROM --platform=$BUILDPLATFORM golang:1.25-alpine AS backend
WORKDIR /backend-build
RUN apk add --no-cache git ca-certificates
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /server/router/frontend/dist ./server/router/frontend/dist
ARG TARGETOS TARGETARCH
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build \
    -trimpath \
    -ldflags="-s -w -extldflags '-static'" \
    -tags netgo,osusergo \
    -o memos \
    ./cmd/memos

FROM alpine:3.21
WORKDIR /usr/local/memos
RUN apk add --no-cache tzdata ca-certificates && \
    addgroup -g 10001 -S nonroot && \
    adduser -u 10001 -S -G nonroot -h /var/opt/memos nonroot && \
    mkdir -p /var/opt/memos && \
    chown -R nonroot:nonroot /var/opt/memos
COPY --from=backend /backend-build/memos /usr/local/memos/memos
COPY --from=backend --chmod=755 /backend-build/scripts/entrypoint.sh /usr/local/memos/entrypoint.sh
USER nonroot:nonroot
ENV TZ="UTC" \
    MEMOS_MODE="prod" \
    MEMOS_PORT="5230" \
    MEMOS_ADDR="0.0.0.0"
EXPOSE 5230
ENTRYPOINT ["/usr/local/memos/entrypoint.sh", "/usr/local/memos/memos"]
