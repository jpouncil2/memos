import { create } from "@bufbuild/protobuf";
import { FieldMaskSchema, timestampDate } from "@bufbuild/protobuf/wkt";
import { CheckIcon, SparklesIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { userServiceClient, memoServiceClient } from "@/connect";
import useAsyncEffect from "@/hooks/useAsyncEffect";
import useNavigateTo from "@/hooks/useNavigateTo";
import { cn } from "@/lib/utils";
import { Memo } from "@/types/proto/api/v1/memo_service_pb";
import { UserNotification, UserNotification_Status } from "@/types/proto/api/v1/user_service_pb";
import { useTranslate } from "@/utils/i18n";

interface Props {
    notification: UserNotification;
}

function SystemNotificationMessage({ notification }: Props) {
    const t = useTranslate();
    const navigateTo = useNavigateTo();
    const [targetMemo, setTargetMemo] = useState<Memo | undefined>(undefined);
    const [initialized, setInitialized] = useState<boolean>(false);

    useAsyncEffect(async () => {
        if (!notification.activityId) {
            // If there's no activityId, it might just be a general message
            setInitialized(true);
            return;
        }

        try {
            // In our current implementation, we might store the memo ID in activityId or similar
            // For system messages, we'll assume activityId maps to a memo if provided
            // This is a placeholder logic that can be refined based on how n8n sends the data
            const memo = await memoServiceClient.getMemo({
                name: `memos/${notification.activityId}`,
            });
            setTargetMemo(memo);
            setInitialized(true);
        } catch (error) {
            // Not strictly an error if no memo is linked
            setInitialized(true);
        }
    }, [notification.activityId]);

    const handleNavigateToMemo = () => {
        if (targetMemo) {
            navigateTo(`/${targetMemo.name}`);
            if (notification.status === UserNotification_Status.UNREAD) {
                handleArchiveMessage(true);
            }
        }
    };

    const handleArchiveMessage = async (silence = false) => {
        await userServiceClient.updateUserNotification({
            notification: {
                name: notification.name,
                status: UserNotification_Status.ARCHIVED,
            },
            updateMask: create(FieldMaskSchema, { paths: ["status"] }),
        });
        if (!silence) {
            toast.success(t("message.archived-successfully"));
        }
    };

    const handleDeleteMessage = async () => {
        await userServiceClient.deleteUserNotification({
            name: notification.name,
        });
        toast.success(t("message.deleted-successfully"));
    };

    const isUnread = notification.status === UserNotification_Status.UNREAD;

    return (
        <div
            className={cn(
                "w-full px-5 py-4 border-b border-border/60 last:border-b-0 transition-all duration-200 group relative",
                isUnread ? "bg-primary/[0.03] hover:bg-primary/[0.05]" : "hover:bg-muted/30",
            )}
        >
            {isUnread && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary to-primary/60" />}

            <div className="flex items-start gap-3">
                {/* Sparkle Icon */}
                <div className="relative shrink-0">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center ring-1 ring-primary/20 shadow-sm">
                        <SparklesIcon className="w-5 h-5 text-primary" strokeWidth={2.5} />
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {!initialized ? (
                        <div className="animate-pulse space-y-2 py-1">
                            <div className="h-4 bg-muted rounded w-1/2"></div>
                            <div className="h-4 bg-muted rounded w-full"></div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-center justify-between gap-3 mb-1">
                                <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                    <span className="font-semibold text-sm text-foreground/95 uppercase tracking-tight text-primary">System Notification</span>
                                    <span className="text-xs text-muted-foreground/60">
                                        {notification.createTime &&
                                            timestampDate(notification.createTime)?.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                                        at{" "}
                                        {notification.createTime &&
                                            timestampDate(notification.createTime)?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {isUnread ? (
                                        <button
                                            onClick={() => handleArchiveMessage()}
                                            className="p-1.5 hover:bg-primary/10 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
                                            title={t("common.archive")}
                                        >
                                            <CheckIcon className="w-4 h-4 text-muted-foreground hover:text-primary transition-colors" strokeWidth={2} />
                                        </button>
                                    ) : (
                                        <button
                                            onClick={handleDeleteMessage}
                                            className="p-1.5 hover:bg-destructive/10 rounded-lg transition-all duration-150 opacity-0 group-hover:opacity-100"
                                            title={t("common.delete")}
                                        >
                                            <TrashIcon className="w-4 h-4 text-muted-foreground hover:text-destructive transition-colors" strokeWidth={2} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div
                                onClick={targetMemo ? handleNavigateToMemo : undefined}
                                className={cn(
                                    "p-3 rounded-lg border transition-all duration-200",
                                    targetMemo
                                        ? "bg-gradient-to-br from-primary/[0.08] to-primary/[0.04] border-primary/20 hover:border-primary/40 cursor-pointer shadow-sm"
                                        : "bg-muted/20 border-transparent"
                                )}
                            >
                                <p className="text-sm font-medium text-foreground/90 mb-1">AI Daily Journal Summary Ready</p>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    Your daily notes, voice recordings, and journal entries have been processed and summarized. Click to view the full recap.
                                </p>
                                {targetMemo && (
                                    <div className="mt-2 flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-widest">
                                        <span>View Recap</span>
                                        <div className="w-1 h-1 rounded-full bg-primary" />
                                        <span>{targetMemo.name}</span>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SystemNotificationMessage;
