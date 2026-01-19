export type BoardCardDefaults = {
  statuses: string[];
  types: string[];
  priorities: string[];
  sizes: string[];
  defaultType: string;
  defaultPriority: string;
  defaultSize: string;
};

export const BOARD_DEFAULTS_EVENT = "memos-board-defaults-updated";

const STORAGE_KEY = "memos-board-card-defaults";

const DEFAULTS: BoardCardDefaults = {
  statuses: ["Backlog", "To Do", "In Progress", "In Review", "Blocked", "Done"],
  types: ["Task", "Bug", "Story", "Epic", "Spike"],
  priorities: ["Highest", "High", "Medium", "Low", "Lowest"],
  sizes: ["XS", "S", "M", "L", "XL"],
  defaultType: "Task",
  defaultPriority: "Medium",
  defaultSize: "M",
};

const sanitizeList = (items: string[]) => items.map((item) => item.trim()).filter(Boolean);

const normalizeDefaults = (value: BoardCardDefaults): BoardCardDefaults => {
  const next = {
    ...value,
    statuses: sanitizeList(value.statuses),
    types: sanitizeList(value.types),
    priorities: sanitizeList(value.priorities),
    sizes: sanitizeList(value.sizes),
  };

  if (!next.types.includes(next.defaultType)) {
    next.defaultType = next.types[0] ?? "";
  }
  if (!next.priorities.includes(next.defaultPriority)) {
    next.defaultPriority = next.priorities[0] ?? "";
  }
  if (!next.sizes.includes(next.defaultSize)) {
    next.defaultSize = next.sizes[0] ?? "";
  }

  return next;
};

export const loadBoardCardDefaults = (): BoardCardDefaults => {
  if (typeof window === "undefined") {
    return DEFAULTS;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULTS;
    }
    const parsed = JSON.parse(stored) as Partial<BoardCardDefaults>;
    return normalizeDefaults({
      ...DEFAULTS,
      ...parsed,
    });
  } catch {
    return DEFAULTS;
  }
};

export const saveBoardCardDefaults = (update: Partial<BoardCardDefaults>): BoardCardDefaults => {
  const current = loadBoardCardDefaults();
  const next = normalizeDefaults({
    ...current,
    ...update,
  });

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage failures.
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(BOARD_DEFAULTS_EVENT));
  }

  return next;
};
