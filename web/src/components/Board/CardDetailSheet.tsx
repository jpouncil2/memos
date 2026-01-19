import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { PaperclipIcon, PlusIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { attachmentServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import {
  boardKeys,
  useCard,
  useCardComments,
  useCardRelations,
  useCardSubtasks,
  useCardTimeEntries,
  useCreateCardComment,
  useCreateCardSubtask,
  useCreateCardTimeEntry,
  useDeleteCardRelation,
  useDeleteCardSubtask,
  useDeleteCardTimeEntry,
  useUpdateCard,
  useUpdateCardSubtask,
  useUpsertCardRelation,
} from "@/hooks/useBoardQueries";
import { cn } from "@/lib/utils";
import type { CardRelation } from "@/types/proto/api/v1/board_service_pb";
import { CardRelationType } from "@/types/proto/api/v1/board_service_pb";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import MemoAttachment from "@/components/MemoAttachment";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Props {
  cardName: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const normalizeCardName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("cards/") ? trimmed : `cards/${trimmed}`;
};

const normalizeMemoName = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.startsWith("memos/") ? trimmed : `memos/${trimmed}`;
};

const formatDateTimeInput = (date?: Date) => {
  if (!date) return "";
  return dayjs(date).format("YYYY-MM-DDTHH:mm");
};

const CardDetailSheet = ({ cardName, open, onOpenChange }: Props) => {
  const currentUser = useCurrentUser();
  const { data: card } = useCard(cardName ?? undefined, { enabled: open && Boolean(cardName) });
  const { data: relations } = useCardRelations(card?.name, { enabled: open && Boolean(card?.name) });
  const { data: subtasks } = useCardSubtasks(card?.name, { enabled: open && Boolean(card?.name) });
  const { data: comments } = useCardComments(card?.name, { enabled: open && Boolean(card?.name) });
  const { data: timeEntries } = useCardTimeEntries(card?.name, { enabled: open && Boolean(card?.name) });

  const updateCard = useUpdateCard();
  const queryClient = useQueryClient();
  const upsertRelation = useUpsertCardRelation();
  const deleteRelation = useDeleteCardRelation();
  const createSubtask = useCreateCardSubtask();
  const updateSubtask = useUpdateCardSubtask();
  const deleteSubtask = useDeleteCardSubtask();
  const createComment = useCreateCardComment();
  const createTimeEntry = useCreateCardTimeEntry();
  const deleteTimeEntry = useDeleteCardTimeEntry();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [priority, setPriority] = useState("");
  const [size, setSize] = useState("");
  const [type, setType] = useState("");
  const [memoLink, setMemoLink] = useState("");
  const [parentLink, setParentLink] = useState("");
  const [epicLink, setEpicLink] = useState("");
  const [dueInput, setDueInput] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newEntryStart, setNewEntryStart] = useState("");
  const [newEntryEnd, setNewEntryEnd] = useState("");

  const epicRelation = useMemo(() => {
    return relations?.relations?.find((relation) => relation.type === CardRelationType.CARD_RELATION_EPIC);
  }, [relations]);

  useEffect(() => {
    if (!card) return;
    setTitle(card.title || "");
    setDescription(card.description || "");
    setTagsInput(card.tags?.join(", ") ?? "");
    setPriority(card.priority || "");
    setSize(card.size || "");
    setType(card.type || "");
    setMemoLink(card.memo || "");
    setParentLink(card.parent || "");
    setEpicLink(epicRelation?.relatedCard || "");
    setDueInput(formatDateTimeInput(card.dueTime ? timestampDate(card.dueTime) : undefined));
  }, [card?.name, epicRelation?.relatedCard]);

  const handleUpdateCard = (update: Record<string, unknown>, updateMask: string[]) => {
    if (!card?.name) return;
    updateCard.mutate({ update: { name: card.name, ...update }, updateMask });
  };

  const handleAttachmentUpload = async (files: FileList | null) => {
    if (!files || !card?.name) return;
    for (const file of Array.from(files)) {
      await attachmentServiceClient.createAttachment({
        attachment: create(AttachmentSchema, {
          filename: file.name,
          size: BigInt(file.size),
          type: file.type,
          content: new Uint8Array(await file.arrayBuffer()),
          card: card.name,
        }),
      });
    }
    queryClient.invalidateQueries({ queryKey: card?.name ? boardKeys.card(card.name) : boardKeys.cards() });
  };

  const handleEpicUpdate = () => {
    if (!card?.name) return;
    const normalized = normalizeCardName(epicLink);
    const existing = epicRelation?.relatedCard || "";
    if (normalized === existing) return;
    if (!normalized && epicRelation?.name) {
      deleteRelation.mutate(epicRelation.name);
      return;
    }
    if (normalized) {
      const relation: CardRelation = {
        name: "",
        card: card.name,
        relatedCard: normalized,
        type: CardRelationType.CARD_RELATION_EPIC,
      };
      if (epicRelation?.name) {
        deleteRelation.mutate(epicRelation.name, {
          onSuccess: () => upsertRelation.mutate(relation),
        });
      } else {
        upsertRelation.mutate(relation);
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle className="text-xl">Card Details</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col gap-6 overflow-y-auto px-6 pb-6">
          <div className="space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => title !== card?.title && handleUpdateCard({ title }, ["title"])}
              placeholder="Task name"
              className="text-lg font-semibold"
            />
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={() => description !== card?.description && handleUpdateCard({ description }, ["description"])}
              placeholder="Description"
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Properties</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Status</label>
                <Input value={card?.status || ""} readOnly />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Assignee</label>
                <select
                  value={card?.assignee || ""}
                  onChange={(e) => handleUpdateCard({ assignee: e.target.value }, ["assignee"])}
                  className={cn(
                    "flex h-8 w-full rounded-md border border-border bg-transparent px-2 text-sm",
                    "focus:border-border focus:outline-none",
                  )}
                >
                  <option value="">Unassigned</option>
                  {currentUser?.name && <option value={currentUser.name}>{currentUser.nickname || currentUser.username}</option>}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Type</label>
                <Input value={type} onChange={(e) => setType(e.target.value)} onBlur={() => handleUpdateCard({ type }, ["type"])} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Priority</label>
                <Input value={priority} onChange={(e) => setPriority(e.target.value)} onBlur={() => handleUpdateCard({ priority }, ["priority"])} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Tags</label>
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onBlur={() => {
                    const tags = tagsInput
                      .split(",")
                      .map((tag) => tag.trim())
                      .filter(Boolean);
                    handleUpdateCard({ tags }, ["tags"]);
                  }}
                  placeholder="tag1, tag2"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Due date</label>
                <Input
                  type="datetime-local"
                  value={dueInput}
                  onChange={(e) => setDueInput(e.target.value)}
                  onBlur={() => {
                    if (!dueInput) {
                      handleUpdateCard({ dueTime: undefined }, ["due_time"]);
                      return;
                    }
                    const parsed = new Date(dueInput);
                    if (!Number.isNaN(parsed.getTime())) {
                      handleUpdateCard({ dueTime: timestampFromDate(parsed) }, ["due_time"]);
                    }
                  }}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Size</label>
                <Input value={size} onChange={(e) => setSize(e.target.value)} onBlur={() => handleUpdateCard({ size }, ["size"])} />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Linked memo</label>
                <Input
                  value={memoLink}
                  onChange={(e) => setMemoLink(e.target.value)}
                  onBlur={() => handleUpdateCard({ memo: normalizeMemoName(memoLink) }, ["memo"])}
                  placeholder="memos/..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Parent</label>
                <Input
                  value={parentLink}
                  onChange={(e) => setParentLink(e.target.value)}
                  onBlur={() => handleUpdateCard({ parent: normalizeCardName(parentLink) }, ["parent"])}
                  placeholder="cards/..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Epic</label>
                <Input
                  value={epicLink}
                  onChange={(e) => setEpicLink(e.target.value)}
                  onBlur={handleEpicUpdate}
                  placeholder="cards/..."
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Attachments</h3>
            <div className="flex flex-wrap gap-2">
              {card?.attachments?.map((attachment) => (
                <MemoAttachment key={attachment.name} attachment={attachment} />
              ))}
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
              <PaperclipIcon className="h-4 w-4" />
              Upload attachments
              <input type="file" multiple className="hidden" onChange={(e) => handleAttachmentUpload(e.target.files)} />
            </label>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Subtasks</h3>
            <div className="space-y-2">
              {subtasks?.subtasks?.map((subtask) => (
                <div key={subtask.name} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={subtask.done}
                    onChange={() => updateSubtask.mutate({ subtask: { name: subtask.name, done: !subtask.done }, updateMask: ["done"] })}
                  />
                  <span className={cn("text-sm flex-1", subtask.done && "line-through text-muted-foreground")}>{subtask.title}</span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => deleteSubtask.mutate(subtask.name)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Input
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="Add subtask"
                  className="h-8"
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-primary"
                  onClick={() => {
                    if (!newSubtask.trim() || !card?.name) return;
                    createSubtask.mutate({
                      parent: card.name,
                      subtask: { title: newSubtask, done: false, order: subtasks?.subtasks?.length ?? 0 },
                    });
                    setNewSubtask("");
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Time tracking</h3>
            <div className="space-y-2">
              {timeEntries?.timeEntries?.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2 text-sm">
                  <span className="flex-1">
                    {entry.startTime && dayjs(timestampDate(entry.startTime)).format("MMM D, HH:mm")} -{" "}
                    {entry.endTime && dayjs(timestampDate(entry.endTime)).format("MMM D, HH:mm")}
                  </span>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => deleteTimeEntry.mutate(entry.name)}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-2">
                <Input type="datetime-local" value={newEntryStart} onChange={(e) => setNewEntryStart(e.target.value)} className="h-8" />
                <Input type="datetime-local" value={newEntryEnd} onChange={(e) => setNewEntryEnd(e.target.value)} className="h-8" />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-primary"
                  onClick={() => {
                    if (!newEntryStart || !newEntryEnd || !card?.name) return;
                    createTimeEntry.mutate({
                      parent: card.name,
                      timeEntry: {
                        startTime: timestampFromDate(new Date(newEntryStart)),
                        endTime: timestampFromDate(new Date(newEntryEnd)),
                      },
                    });
                    setNewEntryStart("");
                    setNewEntryEnd("");
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                  Add
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Comments</h3>
            <div className="space-y-3">
              {comments?.comments?.map((comment) => (
                <div key={comment.name} className="rounded border border-border px-3 py-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {comment.creator} · {comment.createTime && dayjs(timestampDate(comment.createTime)).format("MMM D, HH:mm")}
                  </div>
                  <p>{comment.content}</p>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment"
                  className="min-h-[70px]"
                />
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm text-primary"
                  onClick={() => {
                    if (!newComment.trim() || !card?.name) return;
                    createComment.mutate({ parent: card.name, comment: { content: newComment } });
                    setNewComment("");
                  }}
                >
                  <PlusIcon className="h-4 w-4" />
                  Post
                </button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CardDetailSheet;
