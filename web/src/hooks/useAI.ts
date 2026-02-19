import { create } from "@bufbuild/protobuf";
import { useMutation } from "@tanstack/react-query";
import { aiServiceClient } from "@/connect";
import type { ExecuteAIInstructionRequest } from "@/types/proto/api/v1/ai_service_pb";
import { ExecuteAIInstructionRequestSchema } from "@/types/proto/api/v1/ai_service_pb";

export function useExecuteAIInstruction() {
  return useMutation({
    mutationFn: async (request: Partial<ExecuteAIInstructionRequest>) => {
      const response = await aiServiceClient.executeAIInstruction(
        create(ExecuteAIInstructionRequestSchema, request as Record<string, unknown>),
      );
      return response;
    },
  });
}
