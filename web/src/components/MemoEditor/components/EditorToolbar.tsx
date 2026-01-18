import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import { InsertMenu, VisibilitySelector } from "../Toolbar";
import type { EditorToolbarProps } from "../types";

export const EditorToolbar: FC<EditorToolbarProps> = ({ onSave, onCancel, memoName }) => {
  const { state, actions, dispatch } = useEditorContext();
  const { valid } = validationService.canSave(state);

  const isSaving = state.ui.isLoading.saving;
  const hasPayload = Boolean(state.content.trim() || state.metadata.attachments.length > 0 || state.localFiles.length > 0);
  const showSend = hasPayload || isSaving;

  const handleLocationChange = (location: typeof state.metadata.location) => {
    dispatch(actions.setMetadata({ location }));
  };

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  const handleVisibilityChange = (visibility: typeof state.metadata.visibility) => {
    dispatch(actions.setMetadata({ visibility }));
  };

  return (
    <div className="w-full flex flex-row items-center justify-between gap-2 mt-2">
      <InsertMenu
        isUploading={state.ui.isLoading.uploading}
        location={state.metadata.location}
        onLocationChange={handleLocationChange}
        onToggleFocusMode={handleToggleFocusMode}
        memoName={memoName}
      />

      <div className="flex flex-row justify-end items-center gap-2">
        <VisibilitySelector value={state.metadata.visibility} onChange={handleVisibilityChange} />

        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            Cancel
          </Button>
        )}

        {showSend && (
          <Button onClick={onSave} disabled={!valid || isSaving}>
            {isSaving ? "Sending..." : "Send"}
          </Button>
        )}
      </div>
    </div>
  );
};
