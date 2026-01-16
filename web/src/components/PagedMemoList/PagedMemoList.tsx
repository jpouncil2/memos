import { useQueryClient } from "@tanstack/react-query";
import dayjs from "dayjs";
import { ArrowUpIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { matchPath } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import { useView } from "@/contexts/ViewContext";
import { DEFAULT_LIST_MEMOS_PAGE_SIZE } from "@/helpers/consts";
import { useInfiniteMemos } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";
import { useMediaQuery, useStandaloneMode } from "@/hooks";
import { Routes } from "@/router";
import { State } from "@/types/proto/api/v1/common_pb";
import type { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { useTranslate } from "@/utils/i18n";
import Empty from "../Empty";
import type { MemoRenderContext } from "../MasonryView";
import MasonryView from "../MasonryView";
import MemoEditor from "../MemoEditor";
import MemoFilters from "../MemoFilters";
import Skeleton from "../Skeleton";

interface Props {
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  listSort?: (list: Memo[]) => Memo[];
  state?: State;
  orderBy?: string;
  filter?: string;
  pageSize?: number;
  showCreator?: boolean;
}

function useAutoFetchWhenNotScrollable({
  hasNextPage,
  isFetchingNextPage,
  memoCount,
  onFetchNext,
}: {
  hasNextPage: boolean | undefined;
  isFetchingNextPage: boolean;
  memoCount: number;
  onFetchNext: () => Promise<unknown>;
}) {
  const autoFetchTimeoutRef = useRef<number | null>(null);

  const isPageScrollable = useCallback(() => {
    const documentHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    return documentHeight > window.innerHeight + 100;
  }, []);

  const checkAndFetchIfNeeded = useCallback(async () => {
    if (autoFetchTimeoutRef.current) {
      clearTimeout(autoFetchTimeoutRef.current);
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    const shouldFetch = !isPageScrollable() && hasNextPage && !isFetchingNextPage && memoCount > 0;

    if (shouldFetch) {
      await onFetchNext();

      autoFetchTimeoutRef.current = window.setTimeout(() => {
        void checkAndFetchIfNeeded();
      }, 500);
    }
  }, [hasNextPage, isFetchingNextPage, memoCount, isPageScrollable, onFetchNext]);

  useEffect(() => {
    if (!isFetchingNextPage && memoCount > 0) {
      void checkAndFetchIfNeeded();
    }
  }, [memoCount, isFetchingNextPage, checkAndFetchIfNeeded]);

  useEffect(() => {
    return () => {
      if (autoFetchTimeoutRef.current) {
        clearTimeout(autoFetchTimeoutRef.current);
      }
    };
  }, []);
}

const PagedMemoList = (props: Props) => {
  const t = useTranslate();
  const { layout } = useView();
  const queryClient = useQueryClient();

  const md = useMediaQuery("md");
  const isStandalone = useStandaloneMode();

  // Show memo editor only on the root route
  // In PWA mode on mobile, we hide the top editor since it's moved to the bottom bar in MainLayout
  const showMemoEditor = Boolean(matchPath(Routes.ROOT, window.location.pathname)) && !(isStandalone && !md);

  // Use React Query's infinite query for pagination
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteMemos({
    state: props.state || State.NORMAL,
    orderBy: props.orderBy || "display_time desc",
    filter: props.filter,
    pageSize: props.pageSize || DEFAULT_LIST_MEMOS_PAGE_SIZE,
  });

  // Flatten pages into a single array of memos
  const memos = useMemo(() => data?.pages.flatMap((page) => page.memos) || [], [data]);

  // Apply custom sorting if provided, otherwise use memos directly
  const sortedMemoList = useMemo(() => (props.listSort ? props.listSort(memos) : memos), [memos, props.listSort]);

  // Prefetch creators when new data arrives to improve performance
  useEffect(() => {
    if (!data?.pages || !props.showCreator) return;

    const lastPage = data.pages[data.pages.length - 1];
    if (!lastPage?.memos) return;

    const uniqueCreators = Array.from(new Set(lastPage.memos.map((memo) => memo.creator)));
    for (const creator of uniqueCreators) {
      void queryClient.prefetchQuery({
        queryKey: userKeys.detail(creator),
        queryFn: async () => {
          const user = await userServiceClient.getUser({ name: creator });
          return user;
        },
        staleTime: 1000 * 60 * 5,
      });
    }
  }, [data?.pages, props.showCreator, queryClient]);

  // Auto-fetch hook: fetches more content when page isn't scrollable
  useAutoFetchWhenNotScrollable({
    hasNextPage,
    isFetchingNextPage,
    memoCount: sortedMemoList.length,
    onFetchNext: fetchNextPage,
  });

  // Infinite scroll: fetch more when user scrolls near bottom
  useEffect(() => {
    if (!hasNextPage) return;

    const handleScroll = () => {
      const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 300;
      if (nearBottom && !isFetchingNextPage) {
        fetchNextPage();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const children = (
    <div className="flex flex-col justify-start items-start w-full max-w-full">
      {/* Show skeleton loader during initial load */}
      {isLoading ? (
        <Skeleton showCreator={props.showCreator} count={4} />
      ) : (
        <>
          {layout === "LIST" ? (
            <TimelineView
              memoList={sortedMemoList}
              renderer={props.renderer}
              prefixElement={
                <>
                  {showMemoEditor ? (
                    <MemoEditor className="mb-2" cacheKey="home-memo-editor" placeholder={t("editor.any-thoughts")} />
                  ) : undefined}
                  <MemoFilters />
                </>
              }
            />
          ) : (
            <MasonryView
              memoList={sortedMemoList}
              renderer={props.renderer}
              prefixElement={
                <>
                  {showMemoEditor ? (
                    <MemoEditor className="mb-2" cacheKey="home-memo-editor" placeholder={t("editor.any-thoughts")} />
                  ) : undefined}
                  <MemoFilters />
                </>
              }
              listMode={false} // Explicitly false for grid view, though MasonryView might not check strict boolean if it uses columns prop
            />
          )}

          {/* Loading indicator for pagination */}
          {isFetchingNextPage && <Skeleton showCreator={props.showCreator} count={2} />}

          {/* Empty state or back-to-top button */}
          {!isFetchingNextPage && (
            <>
              {!hasNextPage && sortedMemoList.length === 0 ? (
                <div className="w-full mt-12 mb-8 flex flex-col justify-center items-center italic">
                  <Empty />
                  <p className="mt-2 text-muted-foreground">{t("message.no-data")}</p>
                </div>
              ) : (
                <div className="w-full opacity-70 flex flex-row justify-center items-center my-4">
                  <BackToTop />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );

  return children;
};

interface TimelineViewProps {
  memoList: Memo[];
  renderer: (memo: Memo, context?: MemoRenderContext) => JSX.Element;
  prefixElement?: JSX.Element;
}

const TimelineView = ({ memoList, renderer, prefixElement }: TimelineViewProps) => {
  const groupedItems = useMemo(() => {
    const items: ({ type: "header"; dateStr: string; title: string } | { type: "memo"; memo: Memo })[] = [];
    let lastDateStr = "";

    memoList.forEach((memo) => {
      const displayTime = memo.displayTime;
      if (!displayTime) {
        items.push({ type: "memo", memo });
        return;
      }

      // Format date as YYYY-MM-DD for grouping
      const date = dayjs(Number(displayTime.seconds) * 1000);
      const dateStr = date.format("YYYY-MM-DD");

      if (dateStr !== lastDateStr) {
        let title = date.format("dddd, MMMM D, YYYY");
        const today = dayjs();
        if (date.isSame(today, "day")) {
          title = "Today";
        } else if (date.isSame(today.subtract(1, "day"), "day")) {
          title = "Yesterday";
        }

        items.push({ type: "header", dateStr, title });
        lastDateStr = dateStr;
      }

      items.push({ type: "memo", memo });
    });

    return items;
  }, [memoList]);

  return (
    <div className="w-full flex flex-col gap-2">
      {prefixElement}
      {groupedItems.map((item) => {
        if (item.type === "header") {
          return (
            <div
              key={`header-${item.dateStr}`}
              className="sticky top-0 z-10 w-full pt-4 pb-2 bg-background/95 backdrop-blur-sm px-2 text-sm font-medium text-muted-foreground border-b mb-2"
            >
              {item.title}
            </div>
          );
        }
        // Memo item
        // Note: MasonryView wraps items in a div, we might need similar spacing
        return (
          <div key={item.memo.name} className="w-full">
            {renderer(item.memo, { compact: false, columns: 1 })}
          </div>
        );
      })}
    </div>
  );
};

const BackToTop = () => {
  const t = useTranslate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const shouldShow = window.scrollY > 400;
      setIsVisible(shouldShow);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Don't render if not visible
  if (!isVisible) {
    return null;
  }

  return (
    <Button variant="ghost" onClick={scrollToTop}>
      {t("router.back-to-top")}
      <ArrowUpIcon className="ml-1 w-4 h-auto" />
    </Button>
  );
};

export default PagedMemoList;
