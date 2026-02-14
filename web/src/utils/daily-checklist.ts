import dayjs from "dayjs";

export const CHECKLIST_RESET_HOUR = 5;
export const DAILY_CHECKLIST_TAG = "daily-checklist";
export const TEMPLATE_CHECKLIST_TAG = "daily-checklist-template";

export const DEFAULT_TEMPLATE_CONTENT = `# Daily Checklist
## Morning
- [ ] Morning Gratitude
- [ ] Reflect on the Daily Transits Energies

## Study & Learning
- [ ] Study Human Design + Gene Keys
- [ ] Reading
- [ ] Practice Spanish
- [ ] Learning/Training
- [ ] Networking

## Body
- [ ] Stretch
- [ ] Walk
- [ ] Workout

## Mind & Spirit
- [ ] Contemplation Time
- [ ] Meditate
- [ ] Visualization
- [ ] Manifestation Exercises
- [ ] Prayers
- [ ] Record Dreams

## Life
- [ ] Daily Journal
- [ ] Daily Planning
- [ ] Manifesto
- [ ] Play Time
- [ ] Family Time
- [ ] Project Time

#${TEMPLATE_CHECKLIST_TAG}
`;

export const formatChecklistDayKey = (date: Date): string => {
  const shifted = new Date(date.getTime() - CHECKLIST_RESET_HOUR * 60 * 60 * 1000);
  return dayjs(shifted).format("YYYY-MM-DD");
};

export const formatChecklistTitle = (dayKey: string): string => `Daily Checklist — ${dayKey}`;

export const normalizeDailyChecklistContent = (templateContent: string): string => {
  const lines = templateContent.split("\n");
  const filtered = lines.filter((line) => !line.includes(`#${TEMPLATE_CHECKLIST_TAG}`) && line.trim() !== `#${DAILY_CHECKLIST_TAG}`);
  const trimmed = filtered.join("\n").trimEnd();
  return `${trimmed}\n\n#${DAILY_CHECKLIST_TAG}\n`;
};
