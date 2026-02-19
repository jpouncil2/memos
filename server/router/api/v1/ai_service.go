package v1

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"os"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	v1pb "github.com/usememos/memos/proto/gen/api/v1"
)

func (s *APIV1Service) ExecuteAIInstruction(ctx context.Context, request *v1pb.ExecuteAIInstructionRequest) (*v1pb.ExecuteAIInstructionResponse, error) {
	apiKey := os.Getenv("OPENAI_API_KEY")
	if apiKey == "" {
		return nil, status.Errorf(codes.FailedPrecondition, "OPENAI_API_KEY is not set")
	}

	user, err := s.fetchCurrentUser(ctx)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to get user")
	}
	if user == nil {
		return nil, status.Errorf(codes.Unauthenticated, "user not authenticated")
	}

	prompt := request.Instruction
	if request.Content != nil {
		prompt = "Instruction: " + request.Instruction + "\nContent: " + *request.Content
	}

	client := &http.Client{}
	reqBody, _ := json.Marshal(map[string]interface{}{
		"model": "gpt-4o",
		"messages": []map[string]string{
			{"role": "system", "content": "You are a helpful assistant in a note-taking app. Help the user with their request based on the content provided."},
			{"role": "user", "content": prompt},
		},
	})

	req, err := http.NewRequestWithContext(ctx, "POST", "https://api.openai.com/v1/chat/completions", bytes.NewBuffer(reqBody))
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to create OpenAI request")
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to call OpenAI API")
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, status.Errorf(codes.Internal, "OpenAI API returned error: %s", string(body))
	}

	var result struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to decode OpenAI response")
	}

	if len(result.Choices) == 0 {
		return nil, status.Errorf(codes.Internal, "no completion choices returned from OpenAI")
	}

	return &v1pb.ExecuteAIInstructionResponse{
		Content: result.Choices[0].Message.Content,
	}, nil
}
