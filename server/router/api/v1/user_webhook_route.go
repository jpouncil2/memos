package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/usememos/memos/internal/util"
	"github.com/usememos/memos/plugin/webhook"
	"github.com/usememos/memos/server/auth"
	"github.com/usememos/memos/store"
)

const webhookTestResponseBodyLimit = 8 * 1024

type userWebhookTestResponse struct {
	OK           bool   `json:"ok"`
	URL          string `json:"url"`
	StatusCode   int    `json:"statusCode,omitempty"`
	Status       string `json:"status,omitempty"`
	DurationMS   int64  `json:"durationMs"`
	Error        string `json:"error,omitempty"`
	ResponseBody string `json:"responseBody,omitempty"`
}

func (s *APIV1Service) registerUserWebhookTestRoute(e *echo.Echo) {
	e.POST("/api/v1/users/:user/webhooks/:webhook/test", s.testUserWebhook)
}

func (s *APIV1Service) testUserWebhook(c echo.Context) error {
	ctx := s.authenticateEchoRequest(c.Request().Context(), c.Request().Header.Get(echo.HeaderAuthorization))
	currentUser, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get current user"})
	}
	if currentUser == nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "user not authenticated"})
	}

	userID, err := util.ConvertStringToInt32(c.Param("user"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid user id"})
	}
	if currentUser.ID != userID && currentUser.Role != store.RoleAdmin {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "permission denied"})
	}

	webhookID := strings.TrimSpace(c.Param("webhook"))
	if webhookID == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "invalid webhook id"})
	}

	webhooks, err := s.Store.GetUserWebhooks(ctx, userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "failed to get user webhooks"})
	}

	var targetWebhookURL string
	for _, hook := range webhooks {
		if hook.Id == webhookID {
			targetWebhookURL = strings.TrimSpace(hook.Url)
			break
		}
	}
	if targetWebhookURL == "" {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "webhook not found"})
	}

	result := executeWebhookTest(targetWebhookURL, userID)
	return c.JSON(http.StatusOK, result)
}

func (s *APIV1Service) authenticateEchoRequest(ctx context.Context, authHeader string) context.Context {
	result := auth.NewAuthenticator(s.Store, s.Secret).Authenticate(ctx, authHeader)
	if result == nil {
		return ctx
	}
	if result.Claims != nil {
		ctx = auth.SetUserClaimsInContext(ctx, result.Claims)
		ctx = context.WithValue(ctx, auth.UserIDContextKey, result.Claims.UserID)
	}
	if result.User != nil {
		ctx = auth.SetUserInContext(ctx, result.User, result.AccessToken)
	}
	return ctx
}

func executeWebhookTest(targetURL string, userID int32) userWebhookTestResponse {
	requestPayload := &webhook.WebhookRequestPayload{
		URL:          targetURL,
		ActivityType: "memos.webhook.test",
		Creator:      fmt.Sprintf("users/%d", userID),
	}
	payloadBytes, err := json.Marshal(requestPayload)
	if err != nil {
		return userWebhookTestResponse{
			OK:         false,
			URL:        targetURL,
			DurationMS: 0,
			Error:      fmt.Sprintf("failed to marshal payload: %v", err),
		}
	}

	req, err := http.NewRequest(http.MethodPost, targetURL, bytes.NewReader(payloadBytes))
	if err != nil {
		return userWebhookTestResponse{
			OK:         false,
			URL:        targetURL,
			DurationMS: 0,
			Error:      fmt.Sprintf("failed to build request: %v", err),
		}
	}
	req.Header.Set("Content-Type", "application/json")

	start := time.Now()
	resp, err := (&http.Client{Timeout: 30 * time.Second}).Do(req)
	duration := time.Since(start).Milliseconds()
	if err != nil {
		return userWebhookTestResponse{
			OK:         false,
			URL:        targetURL,
			DurationMS: duration,
			Error:      err.Error(),
		}
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(io.LimitReader(resp.Body, webhookTestResponseBodyLimit))
	responseBody := string(body)
	if readErr != nil {
		responseBody = fmt.Sprintf("failed to read response body: %v", readErr)
	}

	ok := resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices
	result := userWebhookTestResponse{
		OK:           ok,
		URL:          targetURL,
		StatusCode:   resp.StatusCode,
		Status:       resp.Status,
		DurationMS:   duration,
		ResponseBody: responseBody,
	}
	if !ok {
		result.Error = fmt.Sprintf("received non-2xx status from webhook endpoint: %d", resp.StatusCode)
	}
	return result
}
