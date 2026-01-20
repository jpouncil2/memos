import { create } from "@bufbuild/protobuf";
import { timestampDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import {
  BookOpenIcon,
  ExternalLinkIcon,
  FileAudioIcon,
  LayoutGridIcon,
  ListIcon,
  PlayIcon,
  SearchIcon,
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
import { attachmentServiceClient } from "@/connect";
import useLoading from "@/hooks/useLoading";
import useMediaQuery from "@/hooks/useMediaQuery";
import { handleError } from "@/lib/error";
import type { Attachment } from "@/types/proto/api/v1/attachment_service_pb";
import { AttachmentSchema } from "@/types/proto/api/v1/attachment_service_pb";
import { getAttachmentUrl } from "@/utils/attachment";
import { formatFileSize, getFileTypeLabel } from "@/utils/format";
import { useTranslate } from "@/utils/i18n";

const PAGE_SIZE = 200;

const isPdfAttachment = (attachment: Attachment) => attachment.type === "application/pdf";
const isAudioAttachment = (attachment: Attachment) => attachment.type.startsWith("audio/");
const isLibraryAttachment = (attachment: Attachment) => !attachment.memo && !attachment.card;

const isPdfFile = (file: File) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
const isAudioFile = (file: File) => file.type.startsWith("audio/") || /\.(mp3|m4a|wav|aac|flac|ogg)$/i.test(file.name);
const getFileMimeType = (file: File) => {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "application/pdf";
  if (name.endsWith(".mp3")) return "audio/mpeg";
  if (name.endsWith(".m4a")) return "audio/mp4";
  if (name.endsWith(".wav")) return "audio/wav";
  if (name.endsWith(".aac")) return "audio/aac";
  if (name.endsWith(".flac")) return "audio/flac";
  if (name.endsWith(".ogg")) return "audio/ogg";
  return "application/octet-stream";
};

const filterLibraryAttachments = (attachments: Attachment[], searchQuery: string): Attachment[] => {
  if (!searchQuery.trim()) return attachments;
  const query = searchQuery.toLowerCase();
  return attachments.filter((attachment) => attachment.filename.toLowerCase().includes(query));
};

const getAttachmentDate = (attachment: Attachment) => {
  return attachment.createTime ? timestampDate(attachment.createTime) : new Date(0);
};

const Library = () => {
  const t = useTranslate();
  const md = useMediaQuery("md");
  const loadingState = useLoading();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [nextPageToken, setNextPageToken] = useState("");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
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

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setIsUploading(true);
    const uploaded: Attachment[] = [];
    try {
      for (const file of Array.from(files)) {
        if (!isPdfFile(file) && !isAudioFile(file)) {
          toast.error(`Unsupported file: ${file.name}`);
          continue;
        }
        const attachment = await attachmentServiceClient.createAttachment({
          attachment: create(AttachmentSchema, {
            filename: file.name,
            size: BigInt(file.size),
            type: getFileMimeType(file),
            content: new Uint8Array(await file.arrayBuffer()),
          }),
        });
        uploaded.push(attachment);
      }
      if (uploaded.length > 0) {
        setAttachments((prev) => [...uploaded, ...prev]);
        toast.success("Added to library");
      }
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

  const filteredAttachments = useMemo(
    () => filterLibraryAttachments(libraryAttachments, searchQuery),
    [libraryAttachments, searchQuery],
  );

  const pdfAttachments = useMemo(
    () =>
      filteredAttachments
        .filter(isPdfAttachment)
        .sort((a, b) => dayjs(getAttachmentDate(b)).unix() - dayjs(getAttachmentDate(a)).unix()),
    [filteredAttachments],
  );

  const audioAttachments = useMemo(
    () =>
      filteredAttachments
        .filter(isAudioAttachment)
        .sort((a, b) => dayjs(getAttachmentDate(b)).unix() - dayjs(getAttachmentDate(a)).unix()),
    [filteredAttachments],
  );

  const handleOpenAttachment = (attachment: Attachment) => {
    setActiveAttachment(attachment);
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
              <div className="flex items-center gap-1">
                <Button
                  variant={viewMode === "list" ? "secondary" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("list")}
                  aria-label="List view"
                >
                  <ListIcon className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "grid" ? "secondary" : "outline"}
                  size="icon"
                  onClick={() => setViewMode("grid")}
                  aria-label="Grid view"
                >
                  <LayoutGridIcon className="w-4 h-4" />
                </Button>
              </div>
              <Button variant="outline" onClick={handleUploadClick} disabled={isUploading}>
                <UploadCloudIcon className="w-4 h-4" />
                {t("common.upload")}
              </Button>
            </div>
          </div>

          <div className="w-full flex flex-col gap-6 mt-5 mb-3">
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
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground">PDF Library</h3>
                    <span className="text-xs text-muted-foreground">{pdfAttachments.length}</span>
                  </div>
                  {viewMode === "grid" ? (
                    <div className="flex flex-wrap gap-4">
                      {pdfAttachments.map((attachment) => (
                        <div key={attachment.name} className="w-32 sm:w-36 flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenAttachment(attachment)}
                            className="w-full h-32 rounded-xl border border-border bg-card/40 hover:bg-accent/20 transition-colors flex items-center justify-center"
                          >
                            <BookOpenIcon className="w-6 h-6 text-muted-foreground" />
                          </button>
                          <div className="flex items-center justify-between gap-2 px-1">
                            <p className="text-xs text-muted-foreground truncate">{attachment.filename}</p>
                            <button
                              type="button"
                              onClick={() => handleOpenAttachment(attachment)}
                              className="text-primary hover:opacity-80 transition-opacity"
                              aria-label="Open PDF"
                            >
                              <ExternalLinkIcon className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="px-1 text-[11px] text-muted-foreground/80">
                            {getFileTypeLabel(attachment.type)} · {formatFileSize(Number(attachment.size))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
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
                          <span className="text-xs text-muted-foreground">{getFileTypeLabel(attachment.type)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <Separator className="my-2" />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-muted-foreground">Audio Library</h3>
                    <span className="text-xs text-muted-foreground">{audioAttachments.length}</span>
                  </div>
                  {viewMode === "grid" ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {audioAttachments.map((attachment) => (
                        <div key={attachment.name} className="rounded-2xl border border-border bg-card/40 p-3 flex flex-col gap-2">
                          <div className="flex items-center gap-3">
                            <FileAudioIcon className="w-5 h-5 text-muted-foreground" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{attachment.filename}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatFileSize(Number(attachment.size))} · {dayjs(getAttachmentDate(attachment)).format("MMM D")}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenAttachment(attachment)}
                              className="text-primary hover:opacity-80 transition-opacity"
                              aria-label="Open audio file"
                            >
                              <ExternalLinkIcon className="w-4 h-4" />
                            </button>
                          </div>
                          <audio className="w-full" controls preload="metadata" src={getAttachmentUrl(attachment)} />
                        </div>
                      ))}
                    </div>
                  ) : (
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
                          <span className="text-xs text-muted-foreground">{getFileTypeLabel(attachment.type)}</span>
                        </button>
                      ))}
                    </div>
                  )}
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
            accept="application/pdf,audio/*,.pdf,.mp3,.m4a,.wav,.aac,.flac,.ogg"
          />
        </div>
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
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default Library;
