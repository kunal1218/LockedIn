"use client";

import type { MouseEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { deriveCollegeFromDomain } from "@/lib/college";
import { formatRelativeTime } from "@/lib/time";

const ctaClasses =
  "inline-flex items-center justify-center rounded-full border border-card-border bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent/60";
const actionClasses =
  "rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink";

type FriendUser = {
  id: string;
  name: string;
  handle: string;
  collegeName?: string | null;
  collegeDomain?: string | null;
};

type FriendRequest = {
  id: string;
  createdAt: string;
  requester: FriendUser;
  recipient: FriendUser;
};

type FriendSummary = {
  friends: FriendUser[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
  blocked: FriendUser[];
};

const getCollegeLabel = (user: FriendUser) => {
  return (
    user.collegeName ??
    deriveCollegeFromDomain(user.collegeDomain ?? "")
  );
};

export default function FriendsPage() {
  const router = useRouter();
  const { token, isAuthenticated, openAuthModal } = useAuth();
  const [summary, setSummary] = useState<FriendSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshSummary = useCallback(async () => {
    if (!token) {
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGet<FriendSummary>("/friends/summary", token);
      setSummary(response);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load friends."
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    refreshSummary();
  }, [refreshSummary, token]);

  const handleCancelRequest = async (handle: string) => {
    if (!token) {
      openAuthModal();
      return;
    }
    await apiDelete(`/friends/requests/with/${encodeURIComponent(handle)}`, token);
    refreshSummary();
  };

  const handleRemove = async (handle: string) => {
    if (!token) {
      openAuthModal();
      return;
    }
    await apiDelete(`/friends/${encodeURIComponent(handle)}`, token);
    refreshSummary();
  };

  const handleBlock = async (handle: string) => {
    if (!token) {
      openAuthModal();
      return;
    }
    await apiPost(`/friends/block/${encodeURIComponent(handle)}`, {}, token);
    refreshSummary();
  };

  const handleUnblock = async (handle: string) => {
    if (!token) {
      openAuthModal();
      return;
    }
    await apiDelete(`/friends/block/${encodeURIComponent(handle)}`, token);
    refreshSummary();
  };

  const handleRowNavigation = (slug: string) => {
    if (!slug) {
      return;
    }
    router.push(`/messages/${encodeURIComponent(slug)}`);
  };

  const stopRowClick = (event: MouseEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Friends</h1>
          <p className="text-sm text-muted">
            Keep tabs on the people you want to build with.
          </p>
        </div>
        <Link
          href="/notifications"
          className="inline-flex items-center justify-center rounded-full border border-card-border bg-white/80 px-4 py-2 text-xs font-semibold text-ink transition hover:border-accent/50 hover:text-ink"
        >
          Notifications
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-[320px,1fr]">
        <Card className="flex h-[70vh] min-h-[520px] flex-col border border-card-border/70 bg-white/80 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Your circle</h2>
              <p className="text-xs text-muted">Choose a friend to jump into chat.</p>
            </div>
            {!isAuthenticated ? (
              <Button onClick={() => openAuthModal("signup")}>
                Join to connect
              </Button>
            ) : (
              <Link
                href="/notifications"
                className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/50 hover:text-ink"
              >
                Requests
              </Link>
            )}
          </div>

          {!isAuthenticated ? (
            <p className="mt-4 text-sm text-muted">
              Sign up to build your campus circle and see pending requests.
            </p>
          ) : isLoading ? (
            <p className="mt-4 text-sm text-muted">Loading friends...</p>
          ) : error ? (
            <p className="mt-4 text-sm font-semibold text-accent">{error}</p>
          ) : summary && summary.friends.length > 0 ? (
            <div className="mt-3 flex-1 overflow-y-auto space-y-2 pr-1">
              {summary.friends.map((friend) => {
                const collegeLabel = getCollegeLabel(friend);
                const slug = friend.handle.replace(/^@/, "").trim();
                const messageSlug =
                  slug || friend.handle.replace(/^@/, "").trim();
                return (
                  <div
                    key={friend.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open chat with ${friend.handle}`}
                    className="group flex items-center gap-3 rounded-xl border border-card-border/60 bg-white px-3 py-2 transition hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                    onClick={() => handleRowNavigation(messageSlug)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleRowNavigation(messageSlug);
                      }
                    }}
                  >
                    <Avatar name={friend.name} size={36} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {friend.handle}
                      </p>
                      <p className="text-xs text-muted">
                        {collegeLabel ? `${collegeLabel}` : "Campus member"}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        type="button"
                        className={actionClasses}
                        onClick={(event) => {
                          stopRowClick(event);
                          handleRemove(friend.handle);
                        }}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className={actionClasses}
                        onClick={(event) => {
                          stopRowClick(event);
                          handleBlock(friend.handle);
                        }}
                      >
                        Block
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-card-border/70 bg-white/70 px-4 py-5 text-sm text-muted">
              Your friends list is empty for now. Start a convo and we will fill this
              side panel with your people.
            </div>
          )}

          {isAuthenticated && (
            <div className="mt-4 rounded-xl border border-dashed border-card-border/70 bg-white/70 px-4 py-3 text-xs text-muted">
              Incoming requests now live in{" "}
              <Link
                className="font-semibold text-ink transition hover:text-accent"
                href="/notifications"
              >
                notifications
              </Link>
              . Accept or deny them there, then come back to keep chatting.
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card className="h-[70vh] min-h-[520px] border border-card-border/70 bg-white/80 shadow-sm">
            <div className="flex h-full flex-col justify-between">
              <div className="space-y-3">
                <p className="text-sm font-semibold text-accent">Direct messages</p>
                <h2 className="font-display text-2xl font-semibold text-ink">
                  Pick a friend to start chatting.
                </h2>
                <p className="text-sm text-muted">
                  Your chat opens instantly when you tap someone on the left. It is the
                  fastest way to keep the momentum going.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Link href="/map" className={ctaClasses}>
                    Explore map
                  </Link>
                  <Link href="/requests" className={ctaClasses}>
                    View requests
                  </Link>
                  <Link href="/notifications" className={ctaClasses}>
                    Notifications
                  </Link>
                </div>
                <p className="text-xs text-muted">
                  Pending invites have moved to notifications so they are easy to manage.
                </p>
              </div>
            </div>
          </Card>

          {isAuthenticated && summary && summary.outgoing.length > 0 && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">Requests sent</h3>
                <span className="text-xs text-muted">
                  {summary.outgoing.length} active
                </span>
              </div>
              {summary.outgoing.map((request) => {
                const recipient = request.recipient;
                const collegeLabel = getCollegeLabel(recipient);
                return (
                  <div
                    key={request.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-card-border/70 bg-white/70 px-4 py-3"
                  >
                    <Avatar name={recipient.name} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {recipient.handle}
                      </p>
                      <p className="text-xs text-muted">
                        {collegeLabel ? `${collegeLabel}` : "Campus member"} ·{" "}
                        {formatRelativeTime(request.createdAt)}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted">
                        Pending
                      </span>
                      <button
                        type="button"
                        className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                        onClick={() => handleCancelRequest(recipient.handle)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}

          {isAuthenticated && summary && summary.blocked.length > 0 && (
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">Blocked</h3>
                <span className="text-xs text-muted">
                  {summary.blocked.length} blocked
                </span>
              </div>
              {summary.blocked.map((blocked) => {
                const collegeLabel = getCollegeLabel(blocked);
                return (
                  <div
                    key={blocked.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-card-border/70 bg-white/70 px-4 py-3"
                  >
                    <Avatar name={blocked.name} size={32} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {blocked.handle}
                      </p>
                      <p className="text-xs text-muted">
                        {collegeLabel ? `${collegeLabel}` : "Campus member"}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                        onClick={() => handleUnblock(blocked.handle)}
                      >
                        Unblock
                      </button>
                    </div>
                  </div>
                );
              })}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
