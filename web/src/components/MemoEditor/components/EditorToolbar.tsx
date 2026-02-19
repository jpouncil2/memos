import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { useTranslate } from "@/utils/i18n";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import InsertMenu from "../Toolbar/InsertMenu";
import type { EditorToolbarProps } from "../types";

export const EditorToolbar: FC<EditorToolbarProps> = ({ onSave, onCancel, memoName, children }) => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();
  const { valid } = validationService.canSave(state);
  const hasDraft =
    state.content.trim().length > 0 ||
    state.localFiles.length > 0 ||
    state.metadata.attachments.length > 0 ||
    state.metadata.relations.length > 0 ||
    Boolean(state.metadata.location);

  const isSaving = state.ui.isLoading.saving;

  const handleLocationChange = (location: typeof state.metadata.location) => {
    dispatch(actions.setMetadata({ location }));
  };

  const handleToggleFocusMode = () => {
    dispatch(actions.toggleFocusMode());
  };

  if (children) {
    return (
      <div className="w-full flex flex-col gap-2 mb-2">
        <div className="w-full rounded-2xl border bg-card">
          <div className="relative">
            <div className="absolute left-2 top-2 z-10">
              <InsertMenu
                isUploading={state.ui.isLoading.uploading}
                location={state.metadata.location}
                onLocationChange={handleLocationChange}
                onToggleFocusMode={handleToggleFocusMode}
                memoName={memoName}
              />
            </div>
            <div className="pl-11 pr-2 pt-1 min-h-[56px]">{children}</div>
          </div>
          <div className="px-3 pb-2 text-xs text-muted-foreground whitespace-nowrap overflow-hidden text-ellipsis">
            Focus, Attention, Awareness, Imagination and Visualization.
          </div>
        </div>

        <div className="flex flex-row justify-end items-center gap-2">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
              {t("common.cancel")}
            </Button>
          )}

          {hasDraft && (
            <Button onClick={onSave} disabled={!valid || isSaving}>
              {isSaving ? t("editor.saving") : t("editor.save")}
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-row justify-between items-center mb-2">
      <div className="flex flex-row justify-start items-center">
        <InsertMenu
          isUploading={state.ui.isLoading.uploading}
          location={state.metadata.location}
          onLocationChange={handleLocationChange}
          onToggleFocusMode={handleToggleFocusMode}
          memoName={memoName}
        />
      </div>

      <div className="flex flex-row justify-end items-center gap-2">
        {onCancel && (
          <Button variant="ghost" onClick={onCancel} disabled={isSaving}>
            {t("common.cancel")}
          </Button>
        )}

        {hasDraft && (
          <Button onClick={onSave} disabled={!valid || isSaving}>
            {isSaving ? t("editor.saving") : t("editor.save")}
          </Button>
        )}
      </div>
    </div>
  );
};
