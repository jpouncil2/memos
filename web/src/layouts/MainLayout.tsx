import { useEffect, useMemo, useState } from "react";
import { matchPath, Outlet, useLocation } from "react-router-dom";
import MemoEditor from "@/components/MemoEditor";
import type { MemoExplorerContext } from "@/components/MemoExplorer";
import { MemoExplorer, MemoExplorerDrawer } from "@/components/MemoExplorer";
import MobileHeader from "@/components/MobileHeader";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useMediaQuery from "@/hooks/useMediaQuery";
import useStandaloneMode from "@/hooks/useStandaloneMode";
import { cn } from "@/lib/utils";
import { Routes } from "@/router";
import { useTranslate } from "@/utils/i18n";

const MainLayout = () => {
  const md = useMediaQuery("md");
  const lg = useMediaQuery("lg");
  const isStandalone = useStandaloneMode();
  const t = useTranslate();
  const location = useLocation();
  const currentUser = useCurrentUser();
  const [profileUserName, setProfileUserName] = useState<string | undefined>();

  // Determine context based on current route
  const context: MemoExplorerContext = useMemo(() => {
    if (location.pathname === Routes.ROOT) return "home";
    if (location.pathname === Routes.EXPLORE) return "explore";
    if (matchPath("/archived", location.pathname)) return "archived";
    if (matchPath("/u/:username", location.pathname)) return "profile";
    return "home"; // fallback
  }, [location.pathname]);

  const isHomePage = location.pathname === Routes.ROOT;
  const showBottomEditor = isStandalone && !md && isHomePage;

  // Determine context based on current route

  // Extract username from URL for profile context
  useEffect(() => {
    const match = matchPath("/u/:username", location.pathname);
    if (match && context === "profile") {
      const username = match.params.username;
      if (username) {
        // Fetch or get user to obtain user name (e.g., "users/123")
        // Note: User stats will be fetched by useFilteredMemoStats
        userServiceClient
          .getUser({ name: `users/${username}` })
          .then((user) => {
            setProfileUserName(user.name);
          })
          .catch((error) => {
            console.error("Failed to fetch profile user:", error);
            setProfileUserName(undefined);
          });
      }
    } else {
      setProfileUserName(undefined);
    }
  }, [location.pathname, context]);

  // Determine which user name to use for stats
  // - home: current user (uses backend user stats for normal memos)
  // - profile: viewed user (uses backend user stats for normal memos)
  // - archived: undefined (compute from cached archived memos, since user stats only includes normal memos)
  // - explore: undefined (compute from cached memos)
  const statsUserName = useMemo(() => {
    if (context === "home") {
      return currentUser?.name;
    } else if (context === "profile") {
      return profileUserName;
    }
    return undefined; // archived and explore contexts compute from cache
  }, [context, currentUser, profileUserName]);

  // Fetch stats from memo store cache (populated by PagedMemoList)
  // For user-scoped contexts, use backend user stats for tags (unaffected by filters)
  const { statistics, tags } = useFilteredMemoStats({ userName: statsUserName });

  return (
    <>
      <section className="@container w-full min-h-full flex flex-col justify-start items-center">
        {!md && (
          <MobileHeader>
            <MemoExplorerDrawer context={context} statisticsData={statistics} tagCount={tags} />
          </MobileHeader>
        )}
        {md && (
          <div className={cn("fixed top-0 left-16 shrink-0 h-svh transition-all", "border-r border-border", lg ? "w-72" : "w-56")}>
            <MemoExplorer className={cn("px-3 py-6")} context={context} statisticsData={statistics} tagCount={tags} />
          </div>
        )}
        <div className={cn("w-full min-h-full", lg ? "pl-72" : md ? "pl-56" : "")}>
          <div className={cn("w-full mx-auto px-4 sm:px-6 md:pt-6 pb-24", showBottomEditor && "pb-32")}>
            <Outlet />
          </div>
        </div>
      </section>

      {showBottomEditor && (
        <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.5rem)] left-0 right-0 z-[9999] px-4 transition-all duration-300 ease-in-out">
          <div className="w-full rounded-2xl border border-border bg-background/90 backdrop-blur-xl shadow-[0_-8px_30px_rgb(0,0,0,0.12)] px-4 pt-3 pb-3">
            <MemoEditor
              className="!border-none !bg-transparent !shadow-none !px-0 !pt-0"
              cacheKey="pwa-bottom-editor"
              placeholder={t("editor.any-thoughts")}
            />
            <p className="mt-2 text-center text-[11px] leading-tight text-muted-foreground/70">
              Focus, Attention, Awareness, Imagination and Visalization.
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default MainLayout;
