import { ChevronDownIcon, ChevronUpIcon, ExternalLinkIcon, PlusIcon, SendIcon, TrashIcon } from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Link } from "react-router-dom";
import { getAccessToken } from "@/auth-state";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { userServiceClient } from "@/connect";
import useCurrentUser from "@/hooks/useCurrentUser";
import { UserWebhook } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";
import CreateWebhookDialog from "../CreateWebhookDialog";
import SettingTable from "./SettingTable";

interface WebhookTestResponse {
  ok: boolean;
  url: string;
  statusCode?: number;
  status?: string;
  durationMs?: number;
  error?: string;
  responseBody?: string;
}

interface WebhookTestRecord {
  result: WebhookTestResponse;
  testedAt: string;
}

const WebhookSection = () => {
  const t = useTranslate();
  const currentUser = useCurrentUser();
  const [webhooks, setWebhooks] = useState<UserWebhook[]>([]);
  const [isCreateWebhookDialogOpen, setIsCreateWebhookDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserWebhook | undefined>(undefined);
  const [testingWebhookMap, setTestingWebhookMap] = useState<Record<string, boolean>>({});
  const [lastTestResultMap, setLastTestResultMap] = useState<Record<string, WebhookTestRecord>>({});
  const [expandedResultMap, setExpandedResultMap] = useState<Record<string, boolean>>({});

  const listWebhooks = async () => {
    if (!currentUser) return [];
    const { webhooks } = await userServiceClient.listUserWebhooks({
      parent: currentUser.name,
    });
    return webhooks;
  };

  useEffect(() => {
    listWebhooks().then((webhooks) => {
      setWebhooks(webhooks);
    });
  }, [currentUser]);

  const handleCreateWebhookDialogConfirm = async () => {
    const webhooks = await listWebhooks();
    const name = webhooks[webhooks.length - 1]?.displayName || "";
    setWebhooks(webhooks);
    setIsCreateWebhookDialogOpen(false);
    toast.success(t("setting.webhook-section.create-dialog.create-webhook-success", { name }));
  };

  const handleDeleteWebhook = async (webhook: UserWebhook) => {
    setDeleteTarget(webhook);
  };

  const handleTestWebhook = async (webhook: UserWebhook) => {
    setTestingWebhookMap((state) => ({ ...state, [webhook.name]: true }));

    try {
      const accessToken = getAccessToken();
      const headers: HeadersInit = {};
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`;
      }

      const response = await fetch(`/api/v1/${webhook.name}/test`, {
        method: "POST",
        credentials: "include",
        headers,
      });
      const data = (await response.json()) as WebhookTestResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in data && data.error ? data.error : `Request failed (${response.status})`);
      }

      const result = data as WebhookTestResponse;
      setLastTestResultMap((state) => ({
        ...state,
        [webhook.name]: {
          result,
          testedAt: new Date().toISOString(),
        },
      }));
      setExpandedResultMap((state) => ({ ...state, [webhook.name]: true }));
      if (result.ok) {
        toast.success(`${webhook.displayName}: delivered (${result.statusCode ?? "n/a"}) in ${result.durationMs ?? 0}ms`);
      } else {
        const statusText = result.statusCode ? ` (${result.statusCode})` : "";
        toast.error(`${webhook.displayName}: delivery failed${statusText}. ${result.error ?? "Unknown error"}`);
      }
    } catch (error) {
      toast.error(`${webhook.displayName}: ${(error as Error).message}`);
    } finally {
      setTestingWebhookMap((state) => ({ ...state, [webhook.name]: false }));
    }
  };

  const confirmDeleteWebhook = async () => {
    if (!deleteTarget) return;
    await userServiceClient.deleteUserWebhook({ name: deleteTarget.name });
    setWebhooks(webhooks.filter((item) => item.name !== deleteTarget.name));
    setLastTestResultMap((state) => {
      const next = { ...state };
      delete next[deleteTarget.name];
      return next;
    });
    setExpandedResultMap((state) => {
      const next = { ...state };
      delete next[deleteTarget.name];
      return next;
    });
    setDeleteTarget(undefined);
    toast.success(t("setting.webhook-section.delete-dialog.delete-webhook-success", { name: deleteTarget.displayName }));
  };

  const toggleResultDetails = (webhookName: string) => {
    setExpandedResultMap((state) => ({ ...state, [webhookName]: !state[webhookName] }));
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <h4 className="text-sm font-medium text-muted-foreground">{t("setting.webhook-section.title")}</h4>
        <Button onClick={() => setIsCreateWebhookDialogOpen(true)} size="sm">
          <PlusIcon className="w-4 h-4 mr-1.5" />
          {t("common.create")}
        </Button>
      </div>

      <SettingTable
        columns={[
          {
            key: "displayName",
            header: t("common.name"),
            render: (_, webhook: UserWebhook) => <span className="text-foreground">{webhook.displayName}</span>,
          },
          {
            key: "url",
            header: t("setting.webhook-section.url"),
            render: (_, webhook: UserWebhook) => (
              <span className="max-w-[300px] inline-block truncate text-foreground" title={webhook.url}>
                {webhook.url}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "text-right",
            render: (_, webhook: UserWebhook) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="outline" size="sm" disabled={!!testingWebhookMap[webhook.name]} onClick={() => handleTestWebhook(webhook)}>
                  <SendIcon className="w-3.5 h-3.5 mr-1.5" />
                  Test
                </Button>
                {lastTestResultMap[webhook.name] && (
                  <Button variant="ghost" size="sm" onClick={() => toggleResultDetails(webhook.name)}>
                    {expandedResultMap[webhook.name] ? (
                      <ChevronUpIcon className="w-4 h-4 mr-1" />
                    ) : (
                      <ChevronDownIcon className="w-4 h-4 mr-1" />
                    )}
                    Details
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleDeleteWebhook(webhook)}>
                  <TrashIcon className="text-destructive w-4 h-auto" />
                </Button>
              </div>
            ),
          },
        ]}
        data={webhooks}
        emptyMessage={t("setting.webhook-section.no-webhooks-found")}
        getRowKey={(webhook) => webhook.name}
        isRowExpanded={(webhook) => !!expandedResultMap[webhook.name] && !!lastTestResultMap[webhook.name]}
        renderExpandedRow={(webhook) => {
          const record = lastTestResultMap[webhook.name];
          if (!record) return null;
          const { result, testedAt } = record;
          return (
            <div className="w-full flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={result.ok ? "text-green-600" : "text-destructive"}>{result.ok ? "Delivered" : "Failed"}</span>
                {result.statusCode && <span>Status: {result.statusCode}</span>}
                {typeof result.durationMs === "number" && <span>Duration: {result.durationMs}ms</span>}
                <span>Tested: {new Date(testedAt).toLocaleString()}</span>
              </div>
              {result.error && <div className="text-destructive break-words">Error: {result.error}</div>}
              {result.responseBody && (
                <pre className="text-xs max-h-36 overflow-auto p-2 rounded border border-border bg-background whitespace-pre-wrap break-words">
                  {result.responseBody}
                </pre>
              )}
            </div>
          );
        }}
      />

      <div className="w-full">
        <Link
          className="text-muted-foreground text-sm inline-flex items-center hover:underline hover:text-primary"
          to="https://usememos.com/docs/integrations/webhooks"
          target="_blank"
        >
          {t("common.learn-more")}
          <ExternalLinkIcon className="w-4 h-4 ml-1" />
        </Link>
      </div>

      <CreateWebhookDialog
        open={isCreateWebhookDialogOpen}
        onOpenChange={setIsCreateWebhookDialogOpen}
        onSuccess={handleCreateWebhookDialogConfirm}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(undefined)}
        title={t("setting.webhook-section.delete-dialog.delete-webhook-title", { name: deleteTarget?.displayName || "" })}
        description={t("setting.webhook-section.delete-dialog.delete-webhook-description")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={confirmDeleteWebhook}
        confirmVariant="destructive"
      />
    </div>
  );
};

export default WebhookSection;
