import { useEffect, useMemo, useState } from "react";
import { useBoardCardDefaults } from "@/hooks/useBoardCardDefaults";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import SettingGroup from "./SettingGroup";
import SettingRow from "./SettingRow";
import SettingSection from "./SettingSection";

const serializeList = (items: string[]) => items.join("\n");
const parseList = (value: string) =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);

const BoardDefaultsSection = () => {
  const { defaults, updateDefaults } = useBoardCardDefaults();

  const [statusesInput, setStatusesInput] = useState(serializeList(defaults.statuses));
  const [typesInput, setTypesInput] = useState(serializeList(defaults.types));
  const [prioritiesInput, setPrioritiesInput] = useState(serializeList(defaults.priorities));
  const [sizesInput, setSizesInput] = useState(serializeList(defaults.sizes));

  useEffect(() => {
    setStatusesInput(serializeList(defaults.statuses));
    setTypesInput(serializeList(defaults.types));
    setPrioritiesInput(serializeList(defaults.priorities));
    setSizesInput(serializeList(defaults.sizes));
  }, [defaults]);

  const typeOptions = useMemo(() => defaults.types.filter(Boolean), [defaults.types]);
  const priorityOptions = useMemo(() => defaults.priorities.filter(Boolean), [defaults.priorities]);
  const sizeOptions = useMemo(() => defaults.sizes.filter(Boolean), [defaults.sizes]);

  return (
    <SettingSection
      title="Board defaults"
      description="Control the default options used in kanban card dropdowns. Statuses act as a fallback when a board has no columns."
    >
      <SettingGroup title="Card fields">
        <SettingRow
          label="Statuses"
          description="One per line (or comma-separated)."
          vertical
        >
          <Textarea
            value={statusesInput}
            onChange={(event) => setStatusesInput(event.target.value)}
            onBlur={() => updateDefaults({ statuses: parseList(statusesInput) })}
            placeholder="Backlog\nTo Do\nIn Progress"
            className="min-h-[120px]"
          />
        </SettingRow>
        <SettingRow label="Types" description="One per line (or comma-separated)." vertical>
          <Textarea
            value={typesInput}
            onChange={(event) => setTypesInput(event.target.value)}
            onBlur={() => updateDefaults({ types: parseList(typesInput) })}
            placeholder="Task\nBug\nStory"
            className="min-h-[120px]"
          />
        </SettingRow>
        <SettingRow label="Priorities" description="One per line (or comma-separated)." vertical>
          <Textarea
            value={prioritiesInput}
            onChange={(event) => setPrioritiesInput(event.target.value)}
            onBlur={() => updateDefaults({ priorities: parseList(prioritiesInput) })}
            placeholder="Highest\nHigh\nMedium"
            className="min-h-[120px]"
          />
        </SettingRow>
        <SettingRow label="Sizes" description="One per line (or comma-separated)." vertical>
          <Textarea
            value={sizesInput}
            onChange={(event) => setSizesInput(event.target.value)}
            onBlur={() => updateDefaults({ sizes: parseList(sizesInput) })}
            placeholder="XS\nS\nM\nL\nXL"
            className="min-h-[120px]"
          />
        </SettingRow>
      </SettingGroup>

      <SettingGroup title="Defaults">
        <SettingRow label="Default type">
          <Select value={defaults.defaultType} onValueChange={(value) => updateDefaults({ defaultType: value })}>
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              {typeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Default priority">
          <Select value={defaults.defaultPriority} onValueChange={(value) => updateDefaults({ defaultPriority: value })}>
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="Select priority" />
            </SelectTrigger>
            <SelectContent>
              {priorityOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SettingRow label="Default size">
          <Select value={defaults.defaultSize} onValueChange={(value) => updateDefaults({ defaultSize: value })}>
            <SelectTrigger className="min-w-[160px]">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {sizeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
      </SettingGroup>
    </SettingSection>
  );
};

export default BoardDefaultsSection;
