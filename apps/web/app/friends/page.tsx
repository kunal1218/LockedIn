"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { deriveCollegeFromDomain } from "@/lib/college";
import { formatRelativeTime } from "@/lib/time";

const ctaClasses =
  "inline-flex items-center justify-center rounded-full border border-card-border bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent/60";

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

  const handleAccept = async (handle: string) => {
    if (!token) {
      openAuthModal();
      return;
    }
    await apiPost(`/friends/requests/accept/${encodeURIComponent(handle)}`, {}, token);
    refreshSummary();
  };

  const handleDecline = async (handle: string) => {
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

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-semibold">Friends</h1>
          <p className="text-sm text-muted">
            Keep tabs on the people you want to build with.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <Card className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold">Your circle</h2>
              {!isAuthenticated && (
                <Button onClick={() => openAuthModal("signup")}>
                  Join to connect
                </Button>
              )}
            </div>
            {!isAuthenticated ? (
              <p className="text-sm text-muted">
                Sign up to build your campus circle and see pending requests.
              </p>
            ) : isLoading ? (
              <p className="text-sm text-muted">Loading friends...</p>
            ) : error ? (
              <p className="text-sm font-semibold text-accent">{error}</p>
            ) : summary && summary.friends.length > 0 ? (
              <div className="space-y-4">
                {summary.friends.map((friend) => {
                  const collegeLabel = getCollegeLabel(friend);
                  const slug = friend.handle.replace(/^@/, "");
                  return (
                    <div
                      key={friend.id}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-card-border/70 bg-white/70 px-4 py-3"
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
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <Link href={`/profile/${slug}`} className={ctaClasses}>
                          View profile
                        </Link>
                        <button
                          type="button"
                          className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                          onClick={() => handleRemove(friend.handle)}
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                          onClick={() => handleBlock(friend.handle)}
                        >
                          Block
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted">
                Your friends list is empty for now. Start a convo and we will fill
                this space with your people.
              </p>
            )}

            {isAuthenticated && summary && summary.incoming.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-ink">
                  Pending requests
                </h3>
                {summary.incoming.map((request) => {
                  const requester = request.requester;
                  const collegeLabel = getCollegeLabel(requester);
                  return (
                    <div
                      key={request.id}
                      className="flex flex-wrap items-center gap-3 rounded-2xl border border-card-border/70 bg-white/70 px-4 py-3"
                    >
                      <Avatar name={requester.name} size={32} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">
                          {requester.handle}
                        </p>
                        <p className="text-xs text-muted">
                          {collegeLabel ? `${collegeLabel}` : "Campus member"} ·{" "}
                          {formatRelativeTime(request.createdAt)}
                        </p>
                      </div>
                      <div className="ml-auto flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(255,134,88,0.25)] transition hover:translate-y-[-1px]"
                          onClick={() => handleAccept(requester.handle)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                          onClick={() => handleDecline(requester.handle)}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isAuthenticated && summary && summary.outgoing.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-ink">Requests sent</h3>
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
                          onClick={() => handleDecline(recipient.handle)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {isAuthenticated && summary && summary.blocked.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-ink">Blocked</h3>
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
              </div>
            )}
          </Card>

          <Card className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Find new people</h2>
            <p className="text-sm text-muted">
              Browse live campus energy or jump into open requests.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/map" className={ctaClasses}>
                Explore map
              </Link>
              <Link href="/requests" className={ctaClasses}>
                View requests
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
