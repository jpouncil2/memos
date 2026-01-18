import { LatLng } from "leaflet";
import { uniqBy } from "lodash-es";
import { FileIcon, LinkIcon, LoaderIcon, MapPinIcon, Maximize2Icon, PlusIcon, SparklesIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { useDebounce } from "react-use";
import { useReverseGeocoding } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useExecuteAIInstruction } from "@/hooks/useAI";
import type { MemoRelation } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import { LinkMemoDialog, LocationDialog } from "../components";
import { useFileUpload, useLinkMemo, useLocation } from "../hooks";
import { useEditorContext } from "../state";
import type { InsertMenuProps } from "../types";
import type { LocalFile } from "../types/attachment";

const InsertMenu = (props: InsertMenuProps) => {
  const t = useTranslate();
  const { state, actions, dispatch } = useEditorContext();

  const [menuOpen, setMenuOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const aiInstruction = useExecuteAIInstruction();

  const { fileInputRef, selectingFlag, handleFileInputChange, handleUploadClick } = useFileUpload((newFiles: LocalFile[]) => {
    newFiles.forEach((file) => dispatch(actions.addLocalFile(file)));
  });

  const linkMemo = useLinkMemo({
    isOpen: linkDialogOpen,
    currentMemoName: props.memoName,
    existingRelations: state.metadata.relations,
    onAddRelation: (relation: MemoRelation) => {
      dispatch(actions.setMetadata({ relations: uniqBy([...state.metadata.relations, relation], (r) => r.relatedMemo?.name) }));
      setLinkDialogOpen(false);
    },
  });

  const location = useLocation(props.location);

  const [debouncedPosition, setDebouncedPosition] = useState<LatLng | undefined>(undefined);

  useDebounce(
    () => {
      setDebouncedPosition(location.state.position);
    },
    1000,
    [location.state.position],
  );

  const { data: displayName } = useReverseGeocoding(debouncedPosition?.lat, debouncedPosition?.lng);

  useEffect(() => {
    if (displayName) {
      location.setPlaceholder(displayName);
    }
  }, [displayName]);

  const isUploading = selectingFlag || props.isUploading;
  const isAiLoading = aiInstruction.isPending;
  const isBusy = isUploading || isAiLoading;

  const handleAIAction = async (instruction: string) => {
    if (!state.content) {
      toast.error("Add some content first");
      return;
    }
    try {
      const response = await aiInstruction.mutateAsync({ instruction, content: state.content });
      if (response.content) {
        dispatch(actions.updateContent(response.content));
        toast.success("AI matched your request!");
      }
    } catch (error: any) {
      toast.error(error?.message || "AI failed to process");
    }
  };

  const aiItems = useMemo(
    () => [
      { label: "Summarize", instruction: "Summarize this note briefly." },
      { label: "Refine writing", instruction: "Fix grammar and improve the writing style." },
      { label: "Shorten", instruction: "Make this note more concise." },
      { label: "Expand", instruction: "Extend this note with more relevant details." },
      { label: "Translate to English", instruction: "Translate this note to English." },
    ],
    [],
  );

  const handleLocationClick = () => {
    setLocationDialogOpen(true);
    if (!props.location && !location.locationInitialized) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            location.handlePositionChange(new LatLng(position.coords.latitude, position.coords.longitude));
          },
          (error) => {
            console.error("Geolocation error:", error);
          },
        );
      }
    }
  };

  const handleUploadClickWithClose = () => {
    setMenuOpen(false);
    handleUploadClick();
  };

  const handleLinkMemoClick = () => {
    setMenuOpen(false);
    setLinkDialogOpen(true);
  };

  const handleLocationClickWithClose = () => {
    setMenuOpen(false);
    handleLocationClick();
  };

  const handleFocusModeClick = () => {
    setMenuOpen(false);
    props.onToggleFocusMode?.();
  };

  const handleLocationConfirm = () => {
    const newLocation = location.getLocation();
    if (newLocation) {
      props.onLocationChange(newLocation);
      setLocationDialogOpen(false);
    }
  };

  const handleLocationCancel = () => {
    location.reset();
    setLocationDialogOpen(false);
  };

  const handlePositionChange = (position: LatLng) => {
    location.handlePositionChange(position);
  };

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="shadow-none" disabled={isBusy}>
            {isBusy ? <LoaderIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
          </Button>
        </SheetTrigger>
        <SheetContent
          side="bottom"
          className="max-h-[70vh] overflow-y-auto rounded-t-3xl border-t border-border bg-background px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 [&>button]:hidden"
        >
          <div className="mx-auto h-1.5 w-10 rounded-full bg-muted" />
          <div className="mt-4 grid grid-cols-3 gap-3">
            <button
              type="button"
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent/30 disabled:opacity-50"
              onClick={handleUploadClickWithClose}
              disabled={isBusy}
            >
              <FileIcon className="size-5" />
              {t("common.upload")}
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent/30"
              onClick={handleLinkMemoClick}
            >
              <LinkIcon className="size-5" />
              {t("tooltip.link-memo")}
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 px-3 py-3 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-accent/30"
              onClick={handleLocationClickWithClose}
            >
              <MapPinIcon className="size-5" />
              {t("tooltip.select-location")}
            </button>
          </div>

          <div className="mt-4 border-t border-border/60 pt-3">
            <button
              type="button"
              className="w-full rounded-2xl px-3 py-2 text-left transition-colors hover:bg-accent/30"
              onClick={handleFocusModeClick}
            >
              <div className="flex items-start gap-3">
                <Maximize2Icon className="mt-0.5 size-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("editor.focus-mode")}</p>
                  <p className="text-xs text-muted-foreground">Full screen editing</p>
                </div>
                <span className="ml-auto text-xs text-muted-foreground/70">⌘⇧F</span>
              </div>
            </button>
          </div>

          <div className="mt-3 border-t border-border/60 pt-3">
            <p className="px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">AI tools</p>
            <div className="mt-2 flex flex-col gap-1">
              {aiItems.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="w-full rounded-2xl px-3 py-2 text-left transition-colors hover:bg-accent/30 disabled:opacity-50"
                  onClick={() => {
                    setMenuOpen(false);
                    handleAIAction(item.instruction);
                  }}
                  disabled={isAiLoading}
                >
                  <div className="flex items-start gap-3">
                    <SparklesIcon className="mt-0.5 size-5 text-amber-500" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground">Apply to the current memo</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <p className="mt-3 px-2 text-xs text-muted-foreground/70">{t("editor.slash-commands")}</p>
        </SheetContent>
      </Sheet>

      {/* Hidden file input */}
      <input
        className="hidden"
        ref={fileInputRef}
        disabled={isUploading}
        onChange={handleFileInputChange}
        type="file"
        multiple={true}
        accept="*"
      />

      <LinkMemoDialog
        open={linkDialogOpen}
        onOpenChange={setLinkDialogOpen}
        searchText={linkMemo.searchText}
        onSearchChange={linkMemo.setSearchText}
        filteredMemos={linkMemo.filteredMemos}
        isFetching={linkMemo.isFetching}
        onSelectMemo={linkMemo.addMemoRelation}
      />

      <LocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        state={location.state}
        locationInitialized={location.locationInitialized}
        onPositionChange={handlePositionChange}
        onUpdateCoordinate={location.updateCoordinate}
        onPlaceholderChange={location.setPlaceholder}
        onCancel={handleLocationCancel}
        onConfirm={handleLocationConfirm}
      />
    </>
  );
};

export default InsertMenu;
