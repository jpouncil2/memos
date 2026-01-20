import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import {
  BookOpenIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
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

const formatTime = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const { mutateAsync: deleteAttachment } = useDeleteAttachment();

  const [searchQuery, setSearchQuery] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [nextPageToken, setNextPageToken] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadQueue, setUploadQueue] = useState<LocalFile[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const [pinnedItems, setPinnedItems] = useState<string[]>(loadPinnedItems());
  const [activeAudio, setActiveAudio] = useState<Attachment | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

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

  useEffect(() => {
    if (!activeAudio) return;
    setCurrentTime(0);
    setDuration(0);
  }, [activeAudio]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, activeAudio]);

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

  const openAttachment = (attachment: Attachment) => {
    window.location.assign(getAttachmentUrl(attachment));
  };

  const handleAudioSelect = (attachment: Attachment) => {
    if (activeAudio?.name === attachment.name) {
      setIsPlaying((prev) => !prev);
      return;
    }
    setActiveAudio(attachment);
    setIsPlaying(true);
  };

  const handleAttachmentSelect = (attachment: Attachment) => {
    if (isAudioAttachment(attachment)) {
      handleAudioSelect(attachment);
    } else {
      openAttachment(attachment);
    }
  };

  const seekBy = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = Math.min(Math.max(0, audio.currentTime + delta), duration || audio.duration || 0);
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const activeAudioUrl = activeAudio ? getAttachmentUrl(activeAudio) : "";
  const activeAudioProgress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

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
      if (activeAudio?.name === deleteTarget.name) {
        setActiveAudio(null);
        setIsPlaying(false);
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
                          onClick={() => handleAttachmentSelect(attachment)}
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
                        onClick={() => handleAttachmentSelect(attachment)}
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
                  {activeAudio && (
                    <div className="rounded-3xl border border-border bg-card/50 p-4">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="uppercase tracking-wide">Now Playing</span>
                        <span>
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </span>
                      </div>
                      <div className="mt-4 flex flex-col items-center gap-4">
                        <button
                          type="button"
                          onClick={() => seekBy(10)}
                          className="w-24 h-24 rounded-full border border-border bg-muted/30 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                          aria-label="Skip ahead 10 seconds"
                        >
                          <PlayIcon className="w-8 h-8" />
                        </button>
                        <div className="w-full flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatTime(currentTime)}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300 ease-out"
                              style={{ width: `${activeAudioProgress}%` }}
                            />
                          </div>
                          <span>{formatTime(duration)}</span>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-semibold text-foreground">{activeAudio.filename}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(Number(activeAudio.size))}</p>
                        </div>
                        <div className="flex items-center justify-center gap-6">
                          <button
                            type="button"
                            onClick={() => seekBy(-10)}
                            className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Skip back 10 seconds"
                          >
                            <ChevronLeftIcon className="w-5 h-5" />
                            <span className="text-[10px]">10s</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsPlaying((prev) => !prev)}
                            className="w-12 h-12 rounded-full border border-border bg-background flex items-center justify-center text-foreground"
                            aria-label={isPlaying ? "Pause playback" : "Play audio"}
                          >
                            {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => seekBy(10)}
                            className="flex flex-col items-center text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="Skip ahead 10 seconds"
                          >
                            <ChevronRightIcon className="w-5 h-5" />
                            <span className="text-[10px]">10s</span>
                          </button>
                        </div>
                        <p className="text-[11px] text-muted-foreground text-center">Tap the circle to skip ahead 10 seconds.</p>
                      </div>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    {audioAttachments.map((attachment) => (
                      <div
                        key={attachment.name}
                        onClick={() => handleAudioSelect(attachment)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            handleAudioSelect(attachment);
                          }
                        }}
                        className="w-full rounded-2xl border border-border bg-card/40 px-3 py-2 text-left transition-colors hover:bg-accent/20"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleAudioSelect(attachment);
                            }}
                            className="h-12 w-12 rounded-xl border border-border bg-background/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={
                              activeAudio?.name === attachment.name && isPlaying ? "Pause audio" : "Play audio"
                            }
                          >
                            {activeAudio?.name === attachment.name && isPlaying ? (
                              <PauseIcon className="w-5 h-5" />
                            ) : (
                              <PlayIcon className="w-5 h-5" />
                            )}
                          </button>
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
                        </div>
                        {activeAudio?.name === attachment.name && (
                          <div className="mt-2 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300 ease-out"
                              style={{ width: `${activeAudioProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {activeAudio && (
                  <audio
                    ref={audioRef}
                    src={activeAudioUrl}
                    preload="metadata"
                    onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
                    onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
                    onEnded={() => setIsPlaying(false)}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                  />
                )}

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
