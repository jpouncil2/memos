import { create } from "@bufbuild/protobuf";
import { timestampDate, timestampFromDate } from "@bufbuild/protobuf/wkt";
import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { YearCalendar } from "@/components/ActivityCalendar";
import { Checkbox } from "@/components/ui/checkbox";
import { useCreateMemo, useMemos, useUpdateMemo } from "@/hooks/useMemoQueries";
import { cn } from "@/lib/utils";
import { type Memo, MemoSchema, Visibility } from "@/types/proto/api/v1/memo_service_pb";
import {
  CHECKLIST_RESET_HOUR,
  DAILY_CHECKLIST_TAG,
  DEFAULT_TEMPLATE_CONTENT,
  formatChecklistDayKey,
  formatChecklistTitle,
  normalizeDailyChecklistContent,
  TEMPLATE_CHECKLIST_TAG,
} from "@/utils/daily-checklist";
import { useTranslate } from "@/utils/i18n";
import { countTasks, extractTasks, type TaskItem, toggleTaskAtLine } from "@/utils/markdown-manipulation";

interface ChecklistSection {
  title: string;
  tasks: TaskItem[];
}

const getMemoDate = (memo: Memo): Date | undefined => {
  if (memo.displayTime) return timestampDate(memo.displayTime);
  if (memo.createTime) return timestampDate(memo.createTime);
  if (memo.updateTime) return timestampDate(memo.updateTime);
  return undefined;
};

const parseChecklistSections = (content: string): ChecklistSection[] => {
  const lines = content.split("\n");
  const headings = lines
    .map((line, index) => {
      const match = line.match(/^##\s+(.*)$/);
      if (!match) return null;
      return { index, title: match[1].trim() };
    })
    .filter((item): item is { index: number; title: string } => Boolean(item));

  const tasks = extractTasks(content);
  const sections = new Map<string, TaskItem[]>();
  const sectionOrder: string[] = [];
  const fallbackTitle = "Checklist";

  const getSectionForLine = (lineNumber: number) => {
    const heading = [...headings].reverse().find((item) => item.index < lineNumber);
    return heading?.title ?? fallbackTitle;
  };

  for (const task of tasks) {
    const title = getSectionForLine(task.lineNumber);
    if (!sections.has(title)) {
      sections.set(title, []);
      sectionOrder.push(title);
    }
    sections.get(title)?.push(task);
  }

  return sectionOrder.map((title) => ({
    title,
    tasks: sections.get(title) ?? [],
  }));
};

const DailyChecklist = () => {
  const t = useTranslate();
  const dayKey = useMemo(() => formatChecklistDayKey(new Date()), []);
  const dayLabel = useMemo(() => dayjs(dayKey).format("MMMM D, YYYY"), [dayKey]);

  const createMemo = useCreateMemo();
  const updateMemo = useUpdateMemo();
  const [dailyContent, setDailyContent] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const templateQuery = useMemos({
    filter: `tag in ["${TEMPLATE_CHECKLIST_TAG}"]`,
    pageSize: 20,
    orderBy: "display_time desc",
  });

  const dailyQuery = useMemos({
    filter: `tag in ["${DAILY_CHECKLIST_TAG}"]`,
    pageSize: 200,
    orderBy: "display_time desc",
  });

  const templateMemo = templateQuery.data?.memos?.[0];
  const dailyMemo = useMemo(() => {
    const memos = dailyQuery.data?.memos ?? [];
    return memos.find((memo) => {
      const memoDate = getMemoDate(memo);
      if (!memoDate) return false;
      return formatChecklistDayKey(memoDate) === dayKey;
    });
  }, [dailyQuery.data?.memos, dayKey]);

  const templateCreatingRef = useRef(false);
  const dailyCreatingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!templateQuery.isSuccess || templateMemo || templateCreatingRef.current) return;
    templateCreatingRef.current = true;
    createMemo
      .mutateAsync(
        create(MemoSchema, {
          content: DEFAULT_TEMPLATE_CONTENT,
          visibility: Visibility.PRIVATE,
          displayTime: timestampFromDate(new Date()),
        }),
      )
      .catch(() => {
        templateCreatingRef.current = false;
      });
  }, [templateQuery.isSuccess, templateMemo, createMemo]);

  useEffect(() => {
    if (!templateMemo || !dailyQuery.isSuccess || dailyMemo || dailyCreatingRef.current === dayKey) return;
    dailyCreatingRef.current = dayKey;
    const content = normalizeDailyChecklistContent(templateMemo.content);
    setDailyContent(content);
    createMemo
      .mutateAsync(
        create(MemoSchema, {
          content,
          visibility: Visibility.PRIVATE,
          displayTime: timestampFromDate(new Date()),
        }),
      )
      .catch(() => {
        dailyCreatingRef.current = null;
      });
  }, [templateMemo, dailyQuery.isSuccess, dailyMemo, dayKey, createMemo]);

  useEffect(() => {
    if (!dailyMemo?.content) return;
    setDailyContent(dailyMemo.content);
  }, [dailyMemo?.name, dailyMemo?.content]);

  const sections = useMemo(() => {
    if (!dailyContent) return [];
    return parseChecklistSections(dailyContent);
  }, [dailyContent]);

  const handleToggle = useCallback(
    (lineNumber: number, checked: boolean) => {
      if (!dailyMemo) return;
      const nextContent = toggleTaskAtLine(dailyContent, lineNumber, checked);
      setDailyContent(nextContent);
      updateMemo.mutate(
        { update: { name: dailyMemo.name, content: nextContent }, updateMask: ["content"] },
        {
          onError: () => {
            setDailyContent(dailyMemo.content ?? "");
          },
        },
      );
    },
    [dailyMemo, dailyContent, updateMemo],
  );

  const heatmapData = useMemo(() => {
    const data: Record<string, number> = {};
    for (const memo of dailyQuery.data?.memos ?? []) {
      const memoDate = getMemoDate(memo);
      if (!memoDate) continue;
      const key = formatChecklistDayKey(memoDate);
      const { completed } = countTasks(memo.content);
      data[key] = Math.max(data[key] ?? 0, completed);
    }

    if (dailyContent) {
      data[dayKey] = countTasks(dailyContent).completed;
    }

    return data;
  }, [dailyQuery.data?.memos, dailyContent, dayKey]);

  const streakCount = useMemo(() => {
    let streak = 0;
    let cursor = dayjs(dayKey);

    while (true) {
      const key = cursor.format("YYYY-MM-DD");
      if ((heatmapData[key] ?? 0) > 0) {
        streak += 1;
        cursor = cursor.subtract(1, "day");
        continue;
      }
      break;
    }

    return streak;
  }, [heatmapData, dayKey]);

  const tooltipFormatter = useCallback((_count: number, date: string) => dayjs(date).format("MMM D, YYYY"), []);

  return (
    <div className="w-full min-h-full bg-background text-foreground">
      <div className="w-full max-w-6xl mx-auto px-4 py-6 flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold">{t("checklist.title")}</h1>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
            <span>{dayLabel}</span>
            <span>{t("checklist.reset-hint")}</span>
            <span>
              {t("checklist.streak")}: {streakCount} {t("common.days").toLowerCase()}
            </span>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-xl border border-border/60 bg-card/50 p-4 md:p-6 shadow-sm">
            <div className="text-sm text-muted-foreground mb-2">{formatChecklistTitle(dayKey)}</div>
            {sections.length === 0 ? (
              <div className="text-sm text-muted-foreground">{t("checklist.empty")}</div>
            ) : (
              <div className="flex flex-col gap-6">
                {sections.map((section) => (
                  <div key={section.title} className="flex flex-col gap-3">
                    <h2 className="text-sm font-semibold uppercase tracking-widest text-muted-foreground">{section.title}</h2>
                    <div className="flex flex-col gap-2">
                      {section.tasks.map((task) => (
                        <label
                          key={`${section.title}-${task.lineNumber}`}
                          className={cn(
                            "flex items-start gap-3 rounded-md border border-transparent px-2 py-2 transition-colors",
                            task.checked ? "bg-secondary/40 text-muted-foreground" : "hover:bg-secondary/30",
                          )}
                        >
                          <Checkbox
                            checked={task.checked}
                            onCheckedChange={(value) => handleToggle(task.lineNumber, Boolean(value))}
                            className="mt-0.5"
                          />
                          <span className={cn("text-sm leading-relaxed", task.checked && "line-through")}>{task.content}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/60 bg-card/50 p-4 md:p-6 shadow-sm">
            <YearCalendar
              selectedYear={selectedYear}
              data={heatmapData}
              onYearChange={setSelectedYear}
              onDateClick={() => {}}
              tooltipFormatter={tooltipFormatter}
            />
            <div className="text-xs text-muted-foreground mt-2">
              {t("checklist.streak")}: {streakCount} {t("common.days").toLowerCase()}
            </div>
          </div>
        </div>

        <div className="text-xs text-muted-foreground">
          Reset time: {CHECKLIST_RESET_HOUR}:00 local time. Tag: #{DAILY_CHECKLIST_TAG}.
        </div>
      </div>
    </div>
  );
};

export default DailyChecklist;
