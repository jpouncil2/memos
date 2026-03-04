import { useQueryClient } from "@tanstack/react-query";
import { ExternalLinkIcon, WorkflowIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { getAccessToken } from "@/auth-state";
import MobileHeader from "@/components/MobileHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import useMediaQuery from "@/hooks/useMediaQuery";
import { memoKeys } from "@/hooks/useMemoQueries";
import { userKeys } from "@/hooks/useUserQueries";

const RANGE_OPTIONS = [
  { value: "last7Days", label: "Last 7 days" },
  { value: "last14Days", label: "Last 14 days" },
  { value: "last30Days", label: "Last 30 days" },
  { value: "weekToDate", label: "Week to date" },
  { value: "monthToDate", label: "Month to date" },
  { value: "previousWeek", label: "Previous week" },
  { value: "previousMonth", label: "Previous month" },
  { value: "custom", label: "Custom range" },
];

type DigestResponse =
  | { status: "ok"; summary?: string; memoId?: string; memoUrl?: string; message?: string }
  | { status: "empty"; message?: string }
  | { status: "error"; message?: string };

const Agents = () => {
  const md = useMediaQuery("md");
  const queryClient = useQueryClient();
  const [range, setRange] = useState("last14Days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<DigestResponse | null>(null);

  const defaultTimezone = useMemo(() => {
    if (typeof Intl !== "undefined") {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    }
    return "UTC";
  }, []);

  const timezones = useMemo(() => {
    if (
      typeof Intl !== "undefined" &&
      typeof (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf === "function"
    ) {
      return (Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone");
    }
    return [defaultTimezone, "UTC"];
  }, [defaultTimezone]);

  const [timezone, setTimezone] = useState(defaultTimezone);

  const isCustom = range === "custom";
  const canRun = !isCustom || (startDate && endDate);

  const handleRun = async () => {
    if (!canRun) {
      toast.error("Select a start and end date.");
      return;
    }

    setIsRunning(true);
    setResult(null);

    const payload = isCustom ? { startDate, endDate, timezone, title: "Summary of Memos" } : { range, timezone, title: "Summary of Memos" };

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      const accessToken = getAccessToken();
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch("/api/v1/agents/digest", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = `Webhook error (${response.status})`;
        try {
          const errBody = (await response.json()) as { error?: string; message?: string };
          message = errBody.error || errBody.message || message;
        } catch {
          // Keep default message when response body is not JSON.
        }
        throw new Error(message);
      }

      const data = (await response.json()) as DigestResponse;
      setResult(data);

      if (data.status === "ok") {
        toast.success("Summary created.");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: memoKeys.lists() }),
          queryClient.invalidateQueries({ queryKey: userKeys.stats() }),
        ]);
      } else if (data.status === "empty") {
        toast.success(data.message || "No memos in this range.");
      } else {
        toast.error(data.message || "Agent failed to run.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Agent failed to run.";
      setResult({ status: "error", message });
      toast.error(message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center sm:pt-3 md:pt-6 pb-8">
      {!md && <MobileHeader />}
      <div className="w-full px-4 sm:px-6">
        <div className="w-full border border-border flex flex-col justify-start items-start rounded-xl bg-background text-foreground overflow-hidden">
          <div className="w-full px-4 py-4 border-b border-border">
            <div className="flex flex-row items-center gap-2">
              <WorkflowIcon className="w-5 h-auto text-muted-foreground" />
              <h1 className="text-xl font-semibold">Agents</h1>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">Run workflows and automations on your memos.</p>
          </div>

          <div className="w-full p-4">
            <div className="w-full border border-border rounded-xl bg-muted/30 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Summary of Memos</h2>
                  <p className="text-sm text-muted-foreground">Generate a digest for a selected date range and save it as a memo.</p>
                </div>
                <Button onClick={handleRun} disabled={!canRun || isRunning} className="md:mt-1">
                  {isRunning ? "Running..." : "Run summary"}
                </Button>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Range</Label>
                  <Select value={range} onValueChange={setRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      {RANGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isCustom && (
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>End date</Label>
                    <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                  </div>
                </div>
              )}

              <div className="mt-4 border-t border-border pt-4">
                {!result && <p className="text-sm text-muted-foreground">Run the agent to generate a summary.</p>}
                {result?.status === "ok" && (
                  <div className="space-y-3">
                    <div className="text-sm font-medium">Summary</div>
                    <div className="whitespace-pre-wrap rounded-lg border border-border bg-background px-3 py-2 text-sm">
                      {result.summary || "Summary created."}
                    </div>
                    {result.memoUrl && (
                      <a
                        href={result.memoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:opacity-80"
                      >
                        <ExternalLinkIcon className="w-4 h-4" />
                        Open memo
                      </a>
                    )}
                  </div>
                )}
                {result?.status === "empty" && (
                  <p className="text-sm text-muted-foreground">{result.message || "No memos in this range."}</p>
                )}
                {result?.status === "error" && <p className="text-sm text-destructive">{result.message || "Agent failed to run."}</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Agents;
