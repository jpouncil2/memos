import { ChevronDownIcon, ChevronUpIcon, FileIcon, PaperclipIcon, XIcon } from "lucide-react";
import type { FC } from "react";
import { cn } from "@/lib/utils";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import type { LocalFile } from "../types/attachment";
import { toAttachmentItems } from "../types/attachment";

interface AttachmentListProps {
  attachments: Attachment[];
  localFiles?: LocalFile[];
  onAttachmentsChange?: (attachments: Attachment[]) => void;
  onRemoveLocalFile?: (previewUrl: string) => void;
}

const AttachmentItemCard: FC<{
  item: ReturnType<typeof toAttachmentItems>[0];
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}> = ({ item, onRemove, onMoveUp, onMoveDown, canMoveUp = true, canMoveDown = true }) => {
  const { category, filename, thumbnailUrl, mimeType, size, isLocal, progress } = item;
  const fileTypeLabel = getFileTypeLabel(mimeType);
  const fileSizeLabel = size ? formatFileSize(size) : undefined;
  const isUploading = isLocal && typeof progress === "number" && progress < 100;

  return (
    <div className="relative group flex flex-col gap-1.5 px-2 py-2 rounded-md border border-border bg-background/50 transition-all hover:bg-accent/40">
      <div className="flex items-center gap-2">
        <div className="shrink-0 w-8 h-8 rounded border border-border/50 overflow-hidden bg-muted/20 flex items-center justify-center">
          {category === "image" && thumbnailUrl ? (
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <FileIcon className="w-4 h-4 text-muted-foreground/60" />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium truncate" title={filename}>
              {filename}
            </span>
            {isLocal && (
              <span className="shrink-0 px-1 py-0.5 rounded-[3px] bg-primary/10 text-primary text-[10px] font-semibold tracking-wide uppercase">
                {isUploading ? "Uploading" : "Local"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>{fileTypeLabel}</span>
            {fileSizeLabel && (
              <>
                <span className="text-muted-foreground/40">•</span>
                <span>{fileSizeLabel}</span>
              </>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={!canMoveUp}
              className={cn(
                "p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent active:bg-accent/80 transition-all",
                !canMoveUp && "hidden",
              )}
              title="Move up"
            >
              <ChevronUpIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}

          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={!canMoveDown}
              className={cn(
                "p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-accent active:bg-accent/80 transition-all",
                !canMoveDown && "hidden",
              )}
              title="Move down"
            >
              <ChevronDownIcon className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}

          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors ml-0.5"
              title="Remove"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {isUploading && (
        <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden relative">
          <div className="absolute inset-y-0 left-0 bg-primary transition-all duration-300 ease-out" style={{ width: `${progress}%` }} />
          <div className="absolute inset-x-0 bottom-0 top-0 bg-primary/20 animate-pulse" style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
};

const AttachmentList: FC<AttachmentListProps> = ({ attachments, localFiles = [], onAttachmentsChange, onRemoveLocalFile }) => {
  if (attachments.length === 0 && localFiles.length === 0) {
    return null;
  }

  const items = toAttachmentItems(attachments, localFiles);

  const handleMoveUp = (index: number) => {
    if (index === 0 || !onAttachmentsChange) return;

    const newAttachments = [...attachments];
    [newAttachments[index - 1], newAttachments[index]] = [newAttachments[index], newAttachments[index - 1]];
    onAttachmentsChange(newAttachments);
  };

  const handleMoveDown = (index: number) => {
    if (index === attachments.length - 1 || !onAttachmentsChange) return;

    const newAttachments = [...attachments];
    [newAttachments[index], newAttachments[index + 1]] = [newAttachments[index + 1], newAttachments[index]];
    onAttachmentsChange(newAttachments);
  };

  const handleRemoveAttachment = (name: string) => {
    if (onAttachmentsChange) {
      onAttachmentsChange(attachments.filter((attachment) => attachment.name !== name));
    }
  };

  const handleRemoveItem = (item: (typeof items)[0]) => {
    if (item.isLocal) {
      onRemoveLocalFile?.(item.id);
    } else {
      handleRemoveAttachment(item.id);
    }
  };

  return (
    <div className="w-full rounded-lg border border-border bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border bg-muted/30">
        <PaperclipIcon className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Attachments ({items.length})</span>
      </div>

      <div className="p-1 sm:p-1.5 flex flex-col gap-0.5">
        {items.map((item) => {
          const isLocalFile = item.isLocal;
          const attachmentIndex = isLocalFile ? -1 : attachments.findIndex((a) => a.name === item.id);

          return (
            <AttachmentItemCard
              key={item.id}
              item={item}
              onRemove={() => handleRemoveItem(item)}
              onMoveUp={!isLocalFile ? () => handleMoveUp(attachmentIndex) : undefined}
              onMoveDown={!isLocalFile ? () => handleMoveDown(attachmentIndex) : undefined}
              canMoveUp={!isLocalFile && attachmentIndex > 0}
              canMoveDown={!isLocalFile && attachmentIndex < attachments.length - 1}
            />
          );
        })}
      </div>
    </div>
  );
};

export default AttachmentList;
