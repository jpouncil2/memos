import type { FC } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslate } from "@/utils/i18n";
import { validationService } from "../services";
import { useEditorContext } from "../state";
import InsertMenu from "../Toolbar/InsertMenu";
import type { EditorToolbarProps } from "../types";

const formatForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

export const EditorToolbar: FC<EditorToolbarProps> = ({ onSave, onCancel, memoName, createTime, onCreateTimeChange, children }) => {
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
  const createdAtValue = createTime ? formatForInput(createTime) : "";

  const handleLocationChange = (location: typeof state.metadata.location) => {
    dispatch(actions.setMetadata({ location }));
  };

  const handleCreateTimeInputChange = (value: string) => {
    if (!onCreateTimeChange) {
      return;
    }
    if (!value) {
      onCreateTimeChange(undefined);
      return;
    }
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      onCreateTimeChange(date);
    }
  };

  const renderCreateTimeField = () => {
    if (!onCreateTimeChange) {
      return null;
    }
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground whitespace-nowrap">{t("common.created-at")}</span>
        <Input
          type="datetime-local"
          value={createdAtValue}
          onChange={(event) => handleCreateTimeInputChange(event.target.value)}
          className="h-8 w-[220px]"
        />
        {createTime && (
          <Button variant="ghost" size="sm" onClick={() => onCreateTimeChange(undefined)} disabled={isSaving}>
            {t("common.clear")}
          </Button>
        )}
      </div>
    );
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
          <div className="px-3 pb-2 text-[10px] leading-none tracking-tight text-muted-foreground whitespace-nowrap">
            Focus, Attention, Awareness, Imagination and Visualization.
          </div>
        </div>

        <div className="flex flex-row justify-between items-center gap-2">
          {renderCreateTimeField()}
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
        {renderCreateTimeField()}
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
