package v1

import (
	"bytes"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/usememos/memos/server/auth"
)

const agentsDigestPath = "/api/v1/agents/digest"

func (s *APIV1Service) registerAgentsRoutes(e *echo.Echo) {
	// Keep CORS open for browser access; auth handled in handler.
	agentsGroup := e.Group("", echo.MiddlewareFunc(func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			c.Response().Header().Set("Access-Control-Allow-Origin", "*")
			c.Response().Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
			c.Response().Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
			return next(c)
		}
	}))

	agentsGroup.OPTIONS(agentsDigestPath, func(c echo.Context) error {
		return c.NoContent(http.StatusNoContent)
	})
	agentsGroup.POST(agentsDigestPath, s.handleAgentsDigest)
}

func (s *APIV1Service) handleAgentsDigest(c echo.Context) error {
	digestURL := os.Getenv("MEMOS_AGENTS_DIGEST_URL")
	if digestURL == "" {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "agents digest url not configured"})
	}

	authHeader := c.Request().Header.Get("Authorization")
	authenticator := auth.NewAuthenticator(s.Store, s.Secret)
	result := authenticator.Authenticate(c.Request().Context(), authHeader)
	if result == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "authentication required"})
	}

	body, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "failed to read request body"})
	}

	req, err := http.NewRequestWithContext(c.Request().Context(), http.MethodPost, digestURL, bytes.NewReader(body))
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to create upstream request"})
	}
	if contentType := c.Request().Header.Get("Content-Type"); contentType != "" {
		req.Header.Set("Content-Type", contentType)
	} else {
		req.Header.Set("Content-Type", "application/json")
	}
	if key := os.Getenv("MEMOS_AGENTS_DIGEST_KEY"); key != "" {
		req.Header.Set("x-digest-key", key)
	}

	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "failed to reach agents service"})
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return c.JSON(http.StatusBadGateway, map[string]string{"error": "failed to read agents response"})
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType != "" {
		c.Response().Header().Set("Content-Type", contentType)
	}

	return c.Blob(resp.StatusCode, contentType, respBody)
}
