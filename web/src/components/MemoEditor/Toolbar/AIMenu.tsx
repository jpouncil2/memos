import { LoaderIcon, SparklesIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useExecuteAIInstruction } from "@/hooks/useAI";
import { useEditorContext } from "../state";

const AIMenu = () => {
  const { state, actions, dispatch } = useEditorContext();
  const executeAI = useExecuteAIInstruction();
  const [isLoading, setIsLoading] = useState(false);

  const handleAIAction = async (instruction: string) => {
    if (!state.content) {
      toast.error("Content is empty");
      return;
    }

    setIsLoading(true);
    try {
      const response = await executeAI.mutateAsync({
        instruction,
        content: state.content,
      });
      if (response.content) {
        dispatch(actions.updateContent(response.content));
        toast.success("AI matched your request!");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "AI failed to process";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="shadow-none" disabled={isLoading}>
          {isLoading ? <LoaderIcon className="size-4 animate-spin" /> : <SparklesIcon className="size-4 text-amber-500" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={() => handleAIAction("Summarize this note briefly.")}>Summarize</DropdownMenuItem>
        <DropdownMenuItem
          onClick={() =>
            handleAIAction(
              "Summarize this memo in 1-3 sentences, then extract key items as a clean bulleted list. Format:\nSummary: ...\n\nBullets:\n- item",
            )
          }
        >
          Summary + bullet list
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAIAction("Fix grammar and improve the writing style.")}>Refine writing</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAIAction("Make this note more concise.")}>Shorten</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAIAction("Extend this note with more relevant details.")}>Expand</DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleAIAction("Translate this note to English.")}>Translate to English</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AIMenu;
