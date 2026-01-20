import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import {
  BookOpenIcon,
  ExternalLinkIcon,
  PlayIcon,
  SearchIcon,
  StarIcon,
  TrashIcon,
  UploadCloudIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import Empty from "@/components/Empty";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ConfirmDialog from "@/components/ConfirmDialog";
import { attachmentServiceClient } from "@/connect";
import { useDeleteAttachment } from "@/hooks/useAttachmentQueries";
import useLoading from "@/hooks/useLoading";
import useMediaQuery from "@/hooks/useMediaQuery";
import { handleError } from "@/lib/error";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import { useTranslate } from "@/utils/i18n";
import type { LocalFile } from "@/components/MemoEditor/types/attachment";
import { uploadService } from "@/components/MemoEditor/services";

const PAGE_SIZE = 200;
const PINNED_STORAGE_KEY = "memos-library-pins";

const isPdfAttachment = (attachment: Attachment) => attachment.type === "application/pdf";
const isAudioAttachment = (attachment: Attachment) => attachment.type.startsWith("audio/");
const isLibraryAttachment = (attachment: Attachment) => !attachment.memo && !attachment.card;

const isPdfFile = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
const isAudioFile = (file: File) => file.type.startsWith("audio/") || /\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(file.name);

const filterLibraryAttachments = (attachments: Attachment[], searchQuery: string): Attachment[] => {
  if (!searchQuery.trim()) return attachments;
  const query = searchQuery.toLowerCase();
  return attachments.filter((attachment) => attachment.filename.toLowerCase().includes(query));
};

const getAttachmentDate = (attachment: Attachment) => {
  return attachment.createTime ? timestampDate(attachment.createTime) : new Date(0);
};

const loadPinnedItems = (): string[] => {
  try {
    const stored = localStorage.getItem(PINNED_STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
};

const savePinnedItems = (items: string[]) => {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Ignore storage failures.
  }
};

const sortByPinnedAndDate = (items: Attachment[], pinnedSet: Set<string>) => {
  return items.slice().sort((a, b) => {
    const pinnedDelta = Number(pinnedSet.has(b.name)) - Number(pinnedSet.has(a.name));
    if (pinnedDelta !== 0) return pinnedDelta;
    return dayjs(getAttachmentDate(b)).unix() - dayjs(getAttachmentDate(a)).unix();
  });
};

const Library = () => {
  const t = useTranslate();
  const md = useMediaQuery("md");
  const loadingState = useLoading();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { mutateAsync: deleteAttachment } = useDeleteAttachment();

  const [searchQuery, setSearchQuery] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [nextPageToken, setNextPageToken] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<LocalFile[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [pinnedItems, setPinnedItems] = useState<string[]>(loadPinnedItems());
  const [activeAttachment, setActiveAttachment] = useState<Attachment | null>(null);

  const fetchAttachments = useCallback(
    async (pageToken?: string, append = false) => {
      const response = await attachmentServiceClient.listAttachments({
        pageSize: PAGE_SIZE,
        pageToken: pageToken ?? "",
      });
      setAttachments((prev) => (append ? [...prev, ...response.attachments] : response.attachments));
      setNextPageToken(response.nextPageToken ?? "");
    },
    [],
  );

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        await fetchAttachments();
      } catch (error) {
        handleError(error, toast.error, {
          context: "Failed to fetch library items",
          fallbackMessage: "Failed to load library. Please try again.",
        });
      } finally {
        loadingState.setFinish();
      }
    };

    fetchInitial();
  }, [fetchAttachments, loadingState]);

  const handleLoadMore = useCallback(async () => {
    if (!nextPageToken || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await fetchAttachments(nextPageToken, true);
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to load more library items",
        fallbackMessage: "Failed to load more files. Please try again.",
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [fetchAttachments, nextPageToken, isLoadingMore]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const updateUploadQueue = useCallback((previewUrl: string, update: Partial<LocalFile>) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.previewUrl === previewUrl ? { ...item, ...update } : item)),
    );
  }, []);

  const removeUploadItem = useCallback((previewUrl: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.previewUrl !== previewUrl));
  }, []);

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsUploading(true);

    const queueItems: LocalFile[] = Array.from(files).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
    }));

    setUploadQueue((prev) => [...queueItems, ...prev]);

    try {
      await Promise.all(
        queueItems.map(async (localFile) => {
          if (!isPdfFile(localFile.file) && !isAudioFile(localFile.file)) {
            updateUploadQueue(localFile.previewUrl, { error: "Unsupported file" });
            toast.error(`Unsupported file: ${localFile.file.name}`);
            removeUploadItem(localFile.previewUrl);
            URL.revokeObjectURL(localFile.previewUrl);
            return;
          }

          try {
            const attachment = await uploadService.uploadFileWithProgress(localFile, (progress) => {
              updateUploadQueue(localFile.previewUrl, { progress });
            });
            setAttachments((prev) => [attachment, ...prev]);
            updateUploadQueue(localFile.previewUrl, { progress: 100, attachment });
          } catch (error: any) {
            updateUploadQueue(localFile.previewUrl, { error: error?.message || "Upload failed" });
            toast.error(error?.message || "Upload failed");
          } finally {
            removeUploadItem(localFile.previewUrl);
            URL.revokeObjectURL(localFile.previewUrl);
          }
        }),
      );
      toast.success("Added to library");
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to upload library files",
        fallbackMessage: "Upload failed. Please try again.",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const libraryAttachments = useMemo(() => {
    return attachments.filter(isLibraryAttachment).filter((attachment) => isPdfAttachment(attachment) || isAudioAttachment(attachment));
  }, [attachments]);

  const pinnedSet = useMemo(() => new Set(pinnedItems), [pinnedItems]);

  const filteredAttachments = useMemo(
    () => filterLibraryAttachments(libraryAttachments, searchQuery),
    [libraryAttachments, searchQuery],
  );

  const pdfAttachments = useMemo(
    () => sortByPinnedAndDate(filteredAttachments.filter(isPdfAttachment), pinnedSet),
    [filteredAttachments, pinnedSet],
  );

  const audioAttachments = useMemo(
    () => sortByPinnedAndDate(filteredAttachments.filter(isAudioAttachment), pinnedSet),
    [filteredAttachments, pinnedSet],
  );

  const favoriteAttachments = useMemo(() => {
    return filteredAttachments
      .filter((attachment) => pinnedSet.has(attachment.name))
      .slice()
      .sort((a, b) => dayjs(getAttachmentDate(b)).unix() - dayjs(getAttachmentDate(a)).unix());
  }, [filteredAttachments, pinnedSet]);

  const handleOpenAttachment = (attachment: Attachment) => {
    setActiveAttachment(attachment);
  };

  const togglePinned = (attachment: Attachment) => {
    setPinnedItems((prev) => {
      const next = prev.includes(attachment.name)
        ? prev.filter((name) => name !== attachment.name)
        : [attachment.name, ...prev];
      savePinnedItems(next);
      return next;
    });
  };

  const handleDeleteAttachment = async () => {
    if (!deleteTarget) return;
    try {
      await deleteAttachment(deleteTarget.name);
      setAttachments((prev) => prev.filter((attachment) => attachment.name !== deleteTarget.name));
      setPinnedItems((prev) => {
        const next = prev.filter((name) => name !== deleteTarget.name);
        savePinnedItems(next);
        return next;
      });
      if (activeAttachment?.name === deleteTarget.name) {
        setActiveAttachment(null);
      }
      toast.success("Removed from library");
    } catch (error) {
      handleError(error, toast.error, {
        context: "Failed to delete attachment",
        fallbackMessage: "Failed to delete file.",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const activeAttachmentUrl = activeAttachment ? getAttachmentUrl(activeAttachment) : "";
  const activeAttachmentIsPdf = activeAttachment ? isPdfAttachment(activeAttachment) : false;
  const activeAttachmentIsAudio = activeAttachment ? isAudioAttachment(activeAttachment) : false;

  return (
    <>
      <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
        {!md && <MobileHeader />}
        <div className="w-full px-4 sm:px-6">
          <div className="w-full border border-border flex flex-col justify-start items-start px-4 py-3 rounded-xl bg-background text-foreground">
            <div className="relative w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <BookOpenIcon className="w-6 h-auto opacity-80" />
                <span className="text-lg">{t("common.library")}</span>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                <div className="relative w-full sm:w-48">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder={t("common.search")}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
                <Button variant="outline" className="gap-2" onClick={handleUploadClick} disabled={isUploading}>
                  <UploadCloudIcon className="w-4 h-4" />
                  {t("common.upload")}
                </Button>
              </div>
            </div>

            <div className="w-full flex flex-col gap-6 mt-5 mb-3">
              {uploadQueue.length > 0 && (
                <div className="w-full rounded-2xl border border-border bg-muted/30 p-3">
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Uploading</div>
                  <div className="mt-2 flex flex-col gap-2">
                    {uploadQueue.map((item) => {
                      const progress = item.progress ?? 0;
                      return (
                        <div key={item.previewUrl} className="flex flex-col gap-1 rounded-xl border border-border bg-background/60 px-3 py-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="truncate">{item.file.name}</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-muted/50 overflow-hidden relative">
                            <div
                              className="absolute inset-y-0 left-0 bg-primary transition-all duration-300 ease-out"
                              style={{ width: `${progress}%` }}
                            />
                            <div
                              className="absolute inset-x-0 bottom-0 top-0 bg-primary/20 animate-pulse"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {loadingState.isLoading ? (
                <div className="w-full h-32 flex flex-col justify-center items-center">
                  <p className="w-full text-center text-base my-6 mt-8">{t("resource.fetching-data")}</p>
                </div>
              ) : filteredAttachments.length === 0 ? (
                <div className="w-full mt-6 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-4 text-muted-foreground">Upload PDFs or audio to build your library.</p>
                </div>
              ) : (
                <>
                {favoriteAttachments.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-muted-foreground">Favorites</h3>
                      <span className="text-xs text-muted-foreground">{favoriteAttachments.length}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {favoriteAttachments.map((attachment) => (
                        <button
                          key={attachment.name}
                          type="button"
                          onClick={() => handleOpenAttachment(attachment)}
                          className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-3 py-2 text-left transition-colors hover:bg-accent/20"
                        >
                          <div className="h-12 w-12 rounded-xl border border-border bg-background/80 flex items-center justify-center">
                            {isPdfAttachment(attachment) ? (
                              <BookOpenIcon className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <PlayIcon className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{attachment.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatFileSize(Number(attachment.size))} · {dayjs(getAttachmentDate(attachment)).format("MMM D")}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{getFileTypeLabel(attachment.type)}</span>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                togglePinned(attachment);
                              }}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                              aria-label="Unpin item"
                            >
                              <StarIcon className="w-4 h-4 fill-current" />
                            </button>
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                setDeleteTarget(attachment);
                              }}
                              className="text-muted-foreground hover:text-destructive transition-colors"
                              aria-label="Delete favorite"
                            >
                              <TrashIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground">PDF Library</h3>
                    <span className="text-xs text-muted-foreground">{pdfAttachments.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {pdfAttachments.map((attachment) => (
                      <button
                        key={attachment.name}
                        type="button"
                        onClick={() => handleOpenAttachment(attachment)}
                        className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-3 py-2 text-left transition-colors hover:bg-accent/20"
                      >
                        <div className="h-12 w-12 rounded-xl border border-border bg-background/80 flex items-center justify-center">
                          <BookOpenIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{attachment.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(Number(attachment.size))} · {dayjs(getAttachmentDate(attachment)).format("MMM D")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{getFileTypeLabel(attachment.type)}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePinned(attachment);
                            }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Pin item"
                          >
                            <StarIcon className={pinnedSet.has(attachment.name) ? "w-4 h-4 fill-current" : "w-4 h-4"} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(attachment);
                            }}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Delete PDF"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator className="my-2" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground">Audio Library</h3>
                    <span className="text-xs text-muted-foreground">{audioAttachments.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {audioAttachments.map((attachment) => (
                      <button
                        key={attachment.name}
                        type="button"
                        onClick={() => handleOpenAttachment(attachment)}
                        className="w-full flex items-center gap-3 rounded-2xl border border-border bg-card/40 px-3 py-2 text-left transition-colors hover:bg-accent/20"
                      >
                        <div className="h-12 w-12 rounded-xl border border-border bg-background/80 flex items-center justify-center">
                          <PlayIcon className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{attachment.filename}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatFileSize(Number(attachment.size))} · {dayjs(getAttachmentDate(attachment)).format("MMM D")}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{getFileTypeLabel(attachment.type)}</span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              togglePinned(attachment);
                            }}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Pin item"
                          >
                            <StarIcon className={pinnedSet.has(attachment.name) ? "w-4 h-4 fill-current" : "w-4 h-4"} />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteTarget(attachment);
                            }}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                            aria-label="Delete audio"
                          >
                            <TrashIcon className="w-4 h-4" />
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {nextPageToken && (
                  <div className="w-full flex flex-row justify-center items-center mt-2">
                    <Button variant="outline" size="sm" onClick={handleLoadMore} disabled={isLoadingMore}>
                      {isLoadingMore ? t("resource.fetching-data") : t("memo.load-more")}
                    </Button>
                  </div>
                )}
              </>
            )}
            </div>
          </div>
        </div>
        <input
          className="hidden"
          ref={fileInputRef}
          onChange={(event) => handleUploadFiles(event.target.files)}
          type="file"
          multiple
        />
      </section>
      <Sheet open={Boolean(activeAttachment)} onOpenChange={(open) => !open && setActiveAttachment(null)}>
        <SheetContent side="right" className="w-full sm:max-w-4xl">
          {activeAttachment && (
            <>
              <SheetHeader className="border-b border-border">
                <SheetTitle className="text-base">{activeAttachment.filename}</SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
                {activeAttachmentIsPdf && (
                  <div className="flex flex-col gap-3">
                    <Button variant="outline" className="w-fit" onClick={() => window.open(activeAttachmentUrl, "_blank")}>
                      <ExternalLinkIcon className="w-4 h-4" />
                      Open in new tab
                    </Button>
                    <div className="w-full rounded-2xl border border-border overflow-hidden bg-background">
                      <iframe title={activeAttachment.filename} src={activeAttachmentUrl} className="w-full h-[75vh]" />
                    </div>
                  </div>
                )}
                {activeAttachmentIsAudio && (
                  <div className="flex flex-col gap-4">
                    <audio className="w-full" controls preload="metadata" src={activeAttachmentUrl} />
                    <div className="text-xs text-muted-foreground">
                      {formatFileSize(Number(activeAttachment.size))} · {dayjs(getAttachmentDate(activeAttachment)).format("MMM D")}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 px-4 pb-4">
                <Button
                  variant={pinnedSet.has(activeAttachment.name) ? "secondary" : "outline"}
                  onClick={() => togglePinned(activeAttachment)}
                >
                  <StarIcon className={pinnedSet.has(activeAttachment.name) ? "w-4 h-4 fill-current" : "w-4 h-4"} />
                  {pinnedSet.has(activeAttachment.name) ? "Pinned" : "Pin"}
                </Button>
                <Button variant="destructive" onClick={() => setDeleteTarget(activeAttachment)}>
                  <TrashIcon className="w-4 h-4" />
                  Delete
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete file from library?"
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={handleDeleteAttachment}
        confirmVariant="destructive"
      />
    </>
  );
};

export default Library;
