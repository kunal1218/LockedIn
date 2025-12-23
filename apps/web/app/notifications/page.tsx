"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiGet, apiPost } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

type NotificationActor = {
  id: string;
  name: string;
  handle: string;
};

type NotificationItem = {
  id: string;
  type: string;
  createdAt: string;
  readAt: string | null;
  actor: NotificationActor | null;
  messageId: string | null;
  messagePreview: string | null;
};

type NotificationsResponse = {
  notifications: NotificationItem[];
};

export default function NotificationsPage() {
  const { token, isAuthenticated, openAuthModal } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    apiGet<NotificationsResponse>("/notifications", token)
      .then((payload) => {
        if (!isActive) {
          return;
        }
        setNotifications(payload.notifications);
        void apiPost("/notifications/read", {}, token).catch(() => {
          // Ignore read failures; list is still usable.
        });
      })
      .catch((loadError) => {
        if (!isActive) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load notifications."
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-2">
        <Card className="py-10 text-center text-sm text-muted">
          <p className="mb-4 text-base text-ink">Sign in to view notifications.</p>
          <Button requiresAuth={false} onClick={() => openAuthModal("login")}>
            Log in
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold">Notifications</h1>
          <p className="text-sm text-muted">
            Stay on top of new messages and pings.
          </p>
        </div>

        {error && (
          <Card className="border border-accent/30 bg-accent/10 py-4">
            <p className="text-sm font-semibold text-accent">{error}</p>
          </Card>
        )}

        {isLoading ? (
          <Card className="py-10 text-center text-sm text-muted">
            Loading notifications...
          </Card>
        ) : notifications.length === 0 ? (
          <Card className="py-10 text-center text-sm text-muted">
            You are all caught up.
          </Card>
        ) : (
          <Card className="space-y-4">
            {notifications.map((notification) => {
              const actorHandle = notification.actor?.handle ?? "";
              const actorSlug = actorHandle.replace(/^@/, "");
              const isUnread = !notification.readAt;
              const messageLabel = notification.messagePreview
                ? `"${notification.messagePreview}"`
                : "Open the chat to respond.";
              return (
                <div
                  key={notification.id}
                  className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-card-border/70 bg-white/70 px-4 py-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-ink">
                      {notification.type === "message"
                        ? `New message from ${actorHandle || "someone"}`
                        : "New update"}
                    </p>
                    {notification.type === "message" && (
                      <p className="text-xs text-muted">{messageLabel}</p>
                    )}
                    <p className="text-xs text-muted">
                      {formatRelativeTime(notification.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {isUnread && (
                      <span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
                        New
                      </span>
                    )}
                    {notification.type === "message" && actorSlug && (
                      <Link
                        href={`/messages/${encodeURIComponent(actorSlug)}`}
                        className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                      >
                        View chat
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </div>
    </div>
  );
}
