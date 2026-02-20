import { LatLng } from "leaflet";
import { uniqBy } from "lodash-es";
import { FileIcon, LinkIcon, LoaderIcon, type LucideIcon, MapPinIcon, Maximize2Icon, PlusIcon, SparklesIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDebounce } from "react-use";
import { useReverseGeocoding } from "@/components/map";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const { location: initialLocation, onLocationChange, onToggleFocusMode, isUploading: isUploadingProp } = props;
  const executeAI = useExecuteAIInstruction();

  const [menuOpen, setMenuOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

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

  const isUploading = selectingFlag || isUploadingProp;

  const handleOpenLinkDialog = useCallback(() => {
    setLinkDialogOpen(true);
    setMenuOpen(false);
  }, []);

  const handleLocationClick = useCallback(() => {
    setLocationDialogOpen(true);
    setMenuOpen(false);
    if (!initialLocation && !location.locationInitialized) {
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
  }, [initialLocation, location]);

  const handleLocationConfirm = useCallback(() => {
    const newLocation = location.getLocation();
    if (newLocation) {
      onLocationChange(newLocation);
      setLocationDialogOpen(false);
    }
  }, [location, onLocationChange]);

  const handleLocationCancel = useCallback(() => {
    location.reset();
    setLocationDialogOpen(false);
  }, [location]);

  const handlePositionChange = useCallback(
    (position: LatLng) => {
      location.handlePositionChange(position);
    },
    [location],
  );

  const handleToggleFocusMode = useCallback(() => {
    onToggleFocusMode?.();
    setMenuOpen(false);
  }, [onToggleFocusMode]);

  const handleAIAction = useCallback(
    async (instruction: string) => {
      if (!state.content) {
        return;
      }
      setMenuOpen(false);
      const response = await executeAI.mutateAsync({
        instruction,
        content: state.content,
      });
      if (response.content) {
        dispatch(actions.updateContent(response.content));
      }
    },
    [state.content, executeAI, dispatch, actions],
  );

  const menuItems = useMemo(
    () =>
      [
        {
          key: "upload",
          label: t("common.upload"),
          icon: FileIcon,
          onClick: () => {
            setMenuOpen(false);
            handleUploadClick();
          },
        },
        {
          key: "link",
          label: t("tooltip.link-memo"),
          icon: LinkIcon,
          onClick: handleOpenLinkDialog,
        },
        {
          key: "location",
          label: t("tooltip.select-location"),
          icon: MapPinIcon,
          onClick: handleLocationClick,
        },
      ] satisfies Array<{ key: string; label: string; icon: LucideIcon; onClick: () => void }>,
    [handleLocationClick, handleOpenLinkDialog, handleUploadClick, t],
  );

  return (
    <>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg border bg-background shadow-none" disabled={isUploading}>
            {isUploading ? <LoaderIcon className="size-4 animate-spin" /> : <PlusIcon className="size-4" />}
          </Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-6 pt-3">
          <SheetTitle className="sr-only">Insert menu</SheetTitle>
          <div className="grid grid-cols-3 gap-3">
            {menuItems.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.onClick}
                className="rounded-2xl border bg-background px-2 py-3 text-center hover:bg-accent"
              >
                <item.icon className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <div className="text-sm font-medium">{item.label}</div>
              </button>
            ))}
          </div>

          <div className="my-4 h-px bg-border" />

          <button type="button" onClick={handleToggleFocusMode} className="w-full rounded-xl px-2 py-2 text-left hover:bg-accent">
            <div className="flex items-start gap-3">
              <Maximize2Icon className="mt-1 h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-lg font-semibold">{t("editor.focus-mode")}</div>
                <div className="text-sm text-muted-foreground">Full screen editing</div>
              </div>
            </div>
          </button>

          <div className="my-4 h-px bg-border" />

          <div className="px-2 text-xs font-semibold tracking-wide text-muted-foreground">AI TOOLS</div>
          <div className="mt-1">
            <button
              type="button"
              onClick={() => void handleAIAction("Summarize this note briefly.")}
              className="w-full rounded-xl px-2 py-2 text-left hover:bg-accent"
              disabled={executeAI.isPending}
            >
              <div className="flex items-start gap-3">
                <SparklesIcon className="mt-1 h-4 w-4 text-amber-500" />
                <div>
                  <div className="text-lg font-semibold">Summarize</div>
                  <div className="text-sm text-muted-foreground">Apply to the current memo</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleAIAction("Fix grammar and improve the writing style.")}
              className="w-full rounded-xl px-2 py-2 text-left hover:bg-accent"
              disabled={executeAI.isPending}
            >
              <div className="flex items-start gap-3">
                <SparklesIcon className="mt-1 h-4 w-4 text-amber-500" />
                <div>
                  <div className="text-lg font-semibold">Refine writing</div>
                  <div className="text-sm text-muted-foreground">Apply to the current memo</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() =>
                void handleAIAction(
                  "Summarize this memo in 1-3 sentences, then extract key items as a clean bulleted list. Format:\nSummary: ...\n\nBullets:\n- item",
                )
              }
              className="w-full rounded-xl px-2 py-2 text-left hover:bg-accent"
              disabled={executeAI.isPending}
            >
              <div className="flex items-start gap-3">
                <SparklesIcon className="mt-1 h-4 w-4 text-amber-500" />
                <div>
                  <div className="text-lg font-semibold">Summary + bullet list</div>
                  <div className="text-sm text-muted-foreground">Apply to the current memo</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleAIAction("Make this note more concise.")}
              className="w-full rounded-xl px-2 py-2 text-left hover:bg-accent"
              disabled={executeAI.isPending}
            >
              <div className="flex items-start gap-3">
                <SparklesIcon className="mt-1 h-4 w-4 text-amber-500" />
                <div>
                  <div className="text-lg font-semibold">Shorten</div>
                  <div className="text-sm text-muted-foreground">Apply to the current memo</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleAIAction("Extend this note with more relevant details.")}
              className="w-full rounded-xl px-2 py-2 text-left hover:bg-accent"
              disabled={executeAI.isPending}
            >
              <div className="flex items-start gap-3">
                <SparklesIcon className="mt-1 h-4 w-4 text-amber-500" />
                <div>
                  <div className="text-lg font-semibold">Expand</div>
                  <div className="text-sm text-muted-foreground">Apply to the current memo</div>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => void handleAIAction("Translate this note to English.")}
              className="w-full rounded-xl px-2 py-2 text-left hover:bg-accent"
              disabled={executeAI.isPending}
            >
              <div className="flex items-start gap-3">
                <SparklesIcon className="mt-1 h-4 w-4 text-amber-500" />
                <div>
                  <div className="text-lg font-semibold">Translate to English</div>
                  <div className="text-sm text-muted-foreground">Apply to the current memo</div>
                </div>
              </div>
            </button>
          </div>
          <div className="px-2 pt-2 text-sm text-muted-foreground">Type `/` for commands</div>
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
