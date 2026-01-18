import { useLayoutEffect, useRef } from "react";
import useWindowScroll from "react-use/lib/useWindowScroll";
import useMediaQuery from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import NavigationDrawer from "./NavigationDrawer";

interface Props {
  className?: string;
  children?: React.ReactNode;
}

const MobileHeader = (props: Props) => {
  const { className, children } = props;
  const { y: offsetTop } = useWindowScroll();
  const md = useMediaQuery("md");
  const sm = useMediaQuery("sm");
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const root = document.documentElement;

    if (md) {
      root.style.setProperty("--mobile-header-height", "0px");
      return;
    }

    const node = headerRef.current;
    if (!node) {
      root.style.setProperty("--mobile-header-height", "0px");
      return;
    }

    const updateHeight = () => {
      root.style.setProperty("--mobile-header-height", `${node.getBoundingClientRect().height}px`);
    };

    updateHeight();

    if (typeof ResizeObserver === "undefined") {
      return () => {
        root.style.setProperty("--mobile-header-height", "0px");
      };
    }

    const observer = new ResizeObserver(updateHeight);
    observer.observe(node);

    return () => {
      observer.disconnect();
      root.style.setProperty("--mobile-header-height", "0px");
    };
  }, [md]);

  if (md) return null;

  return (
    <div
      ref={headerRef}
      className={cn(
        "sticky top-0 pt-3 pb-2 sm:pt-2 sm:pb-2 px-4 sm:px-6 bg-background backdrop-blur-lg flex flex-row justify-between items-center w-full h-auto flex-nowrap shrink-0 z-30",
        offsetTop > 0 && "shadow-sm",
        className,
      )}
    >
      {!sm && <NavigationDrawer />}
      <div className="w-full flex flex-row justify-end items-center">{children}</div>
    </div>
  );
};

export default MobileHeader;
