import { ChevronDown, ChevronUp, FileText, Image } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";

interface CollapsibleContentProps {
  memo: Memo;
  children: React.ReactNode;
  maxPreviewHeight?: number;
}

const CONTENT_THRESHOLD = 300; // pixels - if content is taller than this, make it collapsible

export const CollapsibleContent = ({ memo, children, maxPreviewHeight = 200 }: CollapsibleContentProps) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);

  // Check if content needs collapsing
  const contentRef = (node: HTMLDivElement | null) => {
    if (node && !needsCollapse) {
      const height = node.scrollHeight;
      if (height > CONTENT_THRESHOLD) {
        setNeedsCollapse(true);
      }
    }
  };

  const hasAttachments = memo.attachments && memo.attachments.length > 0;
  const attachmentCount = memo.attachments?.length || 0;

  // Categorize attachments
  const imageCount = memo.attachments?.filter((a) => a.type.startsWith("image/")).length || 0;
  const fileCount = attachmentCount - imageCount;

  return (
    <div className="relative">
      {/* Content area */}
      <div
        ref={contentRef}
        className={cn("overflow-hidden transition-all duration-300 ease-in-out", !isExpanded && needsCollapse && "relative")}
        style={{
          maxHeight: !isExpanded && needsCollapse ? `${maxPreviewHeight}px` : undefined,
        }}
      >
        {children}

        {/* Gradient fade overlay when collapsed */}
        {!isExpanded && needsCollapse && (
          <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>

      {/* Attachment indicators (shown when collapsed) */}
      {!isExpanded && hasAttachments && (
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          {imageCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/50">
              <Image className="w-3.5 h-3.5" />
              <span>{imageCount}</span>
            </div>
          )}
          {fileCount > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-accent/50">
              <FileText className="w-3.5 h-3.5" />
              <span>{fileCount}</span>
            </div>
          )}
        </div>
      )}

      {/* Expand/Collapse button */}
      {needsCollapse && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center justify-center gap-2 mt-3 py-2 rounded-lg",
            "text-sm font-medium text-muted-foreground hover:text-foreground",
            "bg-accent/30 hover:bg-accent/50 transition-colors",
          )}
          aria-label={isExpanded ? "Collapse content" : "Expand content"}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              <span className="sr-only">Collapse</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              <span className="sr-only">Expand</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default CollapsibleContent;
