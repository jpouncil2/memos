import { useRef } from "react";
import { useMemoFilterContext } from "@/contexts/MemoFilterContext";
import { useFilteredMemoStats } from "@/hooks/useFilteredMemoStats";
import useStandaloneMode from "@/hooks/useStandaloneMode";
import { cn } from "@/lib/utils";

const MobileTagFilters = () => {
    const isStandalone = useStandaloneMode();
    const { tags } = useFilteredMemoStats();
    const { filters, addFilter, removeFilter } = useMemoFilterContext();
    const containerRef = useRef<HTMLDivElement>(null);

    if (!isStandalone) {
        return null;
    }

    // Tags is a Record<string, number>, convert to array and sort by count/name
    const sortedTags = Object.entries(tags)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .map(([tag]) => tag);

    if (sortedTags.length === 0) {
        return null;
    }

    const toggleTag = (tag: string) => {
        const isSelected = filters.some((f) => f.factor === "tagSearch" && f.value === tag);
        if (isSelected) {
            removeFilter((f) => f.factor === "tagSearch" && f.value === tag);
        } else {
            addFilter({ factor: "tagSearch", value: tag });
        }
    };

    return (
        <div
            ref={containerRef}
            className={cn(
                "sticky z-20 w-full flex flex-row items-center justify-start gap-2 overflow-x-auto",
                "hide-scrollbar px-4 py-2 bg-background backdrop-blur-lg shadow-sm",
            )}
            style={{ top: "var(--mobile-header-height, 60px)" }}
        >
            {sortedTags.map((tag) => {
                const isSelected = filters.some((f) => f.factor === "tagSearch" && f.value === tag);
                return (
                    <button
                        key={tag}
                        onClick={() => toggleTag(tag)}
                        className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors",
                            "border",
                            isSelected
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground"
                        )}
                    >
                        #{tag}
                    </button>
                );
            })}
        </div>
    );
};

export default MobileTagFilters;
