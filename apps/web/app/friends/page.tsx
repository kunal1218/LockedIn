"use client";

import type { FormEvent, MouseEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { deriveCollegeFromDomain } from "@/lib/college";
import { formatRelativeTime } from "@/lib/time";
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

type MessageUser = {
  id: string;
  name: string;
  handle: string;
};

type DirectMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: MessageUser;
  recipient: MessageUser;
};

type ThreadResponse = {
  user: MessageUser;
  messages: DirectMessage[];
};

const getCollegeLabel = (user: FriendUser) => {
  return (
    user.collegeName ??
    deriveCollegeFromDomain(user.collegeDomain ?? "")
  );
};

const inputClasses =
  "w-full rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60 focus:bg-white";

const normalizeHandle = (handle: string) => handle.replace(/^@/, "").trim();

export default function FriendsPage() {
  const { token, user, isAuthenticated, openAuthModal } = useAuth();
  const [summary, setSummary] = useState<FriendSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [threadUser, setThreadUser] = useState<MessageUser | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!summary) {
      return;
    }
    const hasFriends = summary.friends.length > 0;
    const firstHandle = hasFriends
      ? normalizeHandle(summary.friends[0].handle)
      : null;
    const containsSelected =
      !!selectedHandle &&
      summary.friends.some(
        (friend) => normalizeHandle(friend.handle) === selectedHandle
      );

    if (!selectedHandle && firstHandle) {
      setSelectedHandle(firstHandle);
    } else if (selectedHandle && !containsSelected) {
      setSelectedHandle(firstHandle ?? null);
    }
  }, [selectedHandle, summary]);

  useEffect(() => {
    if (!token || !selectedHandle) {
      setThreadUser(null);
      setMessages([]);
      return;
    }

    let isActive = true;
    setIsChatLoading(true);
    setChatError(null);
    setThreadUser(null);
    setMessages([]);
    setDraft("");

    apiGet<ThreadResponse>(`/messages/with/${encodeURIComponent(selectedHandle)}`, token)
      .then((payload) => {
        if (!isActive) {
          return;
        }
        setThreadUser(payload.user);
        setMessages(payload.messages);
      })
      .catch((loadError) => {
        if (!isActive) {
          return;
        }
        setChatError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this chat."
        );
        setThreadUser(null);
        setMessages([]);
      })
      .finally(() => {
        if (isActive) {
          setIsChatLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedHandle, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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

  const handleSelectFriend = (handle: string) => {
    setSelectedHandle(normalizeHandle(handle));
    setChatError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      openAuthModal("login");
      return;
    }
    const slug = selectedHandle;
    if (!slug) {
      setChatError("Pick someone to chat with.");
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      setChatError("Write a message before sending.");
      return;
    }

    setIsSending(true);
    setChatError(null);

    try {
      const response = await apiPost<{ message: DirectMessage }>(
        `/messages/with/${encodeURIComponent(slug)}`,
        { body: trimmed },
        token
      );
      setMessages((prev) => [...prev, response.message]);
      setDraft("");
    } catch (submitError) {
      setChatError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to send message."
      );
    } finally {
      setIsSending(false);
    }
  };

  const stopRowClick = (event: MouseEvent) => {
    event.stopPropagation();
  };

  const selectedFriend =
    summary?.friends.find(
      (friend) => normalizeHandle(friend.handle) === selectedHandle
    ) ?? null;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="grid grid-cols-[200px_minmax(0,_1fr)] gap-4 lg:gap-6">
        <Card className="flex h-[82vh] min-h-[560px] flex-col border border-card-border/70 bg-white/80 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Direct messages</h2>
              <p className="text-xs text-muted">
                Tap a friend to swap the chat on the right.
              </p>
            </div>
            {!isAuthenticated ? (
              <Button onClick={() => openAuthModal("signup")}>
                Join
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
              Sign up to see your friends and chats.
            </p>
          ) : isLoading ? (
            <p className="mt-4 text-sm text-muted">Loading friends...</p>
          ) : error ? (
            <p className="mt-4 text-sm font-semibold text-accent">{error}</p>
          ) : summary && summary.friends.length > 0 ? (
            <div className="mt-3 flex-1 overflow-y-auto space-y-1 pr-1">
              {summary.friends.map((friend) => {
                const collegeLabel = getCollegeLabel(friend);
                const slug = normalizeHandle(friend.handle);
                const isActive = slug === selectedHandle;
                return (
                  <div
                    key={friend.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open chat with ${friend.handle}`}
                    aria-selected={isActive}
                    className={`group flex items-center gap-3 rounded-xl border px-3 py-2 transition focus:outline-none focus:ring-2 focus:ring-accent/40 ${
                      isActive
                        ? "border-accent bg-accent/10"
                        : "border-card-border/60 bg-white hover:-translate-y-0.5 hover:border-accent/50 hover:shadow-sm"
                    }`}
                    onClick={() => handleSelectFriend(slug)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleSelectFriend(slug);
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

        <Card className="flex h-[82vh] min-h-[560px] flex-col border border-card-border/70 bg-white/80 shadow-sm">
          {!isAuthenticated ? (
            <div className="flex flex-1 flex-col items-center justify-center space-y-4 text-center">
              <p className="text-base font-semibold text-ink">Sign in to keep chatting.</p>
              <p className="text-sm text-muted">
                Your messages stay put once you are in.
              </p>
              <Button requiresAuth={false} onClick={() => openAuthModal("login")}>
                Log in
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-3">
                <div className="flex items-center gap-3">
                  {threadUser || selectedFriend ? (
                    <Avatar name={(threadUser ?? selectedFriend)?.name ?? ""} size={44} />
                  ) : (
                    <div className="h-11 w-11 rounded-full bg-card-border/60" />
                  )}
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {threadUser?.name ?? selectedFriend?.name ?? "Select a chat"}
                    </p>
                    <p className="text-xs text-muted">
                      {threadUser?.handle ??
                        selectedFriend?.handle ??
                        "Choose someone from the left"}
                    </p>
                  </div>
                </div>
                {selectedFriend && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={actionClasses}
                      onClick={() => handleRemove(selectedFriend.handle)}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className={actionClasses}
                      onClick={() => handleBlock(selectedFriend.handle)}
                    >
                      Block
                    </button>
                  </div>
                )}
              </div>

              {chatError && (
                <div className="mt-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent">
                  {chatError}
                </div>
              )}

              <div className="flex-1 overflow-y-auto pr-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {isChatLoading ? (
                  <p className="text-sm text-muted">Loading chat...</p>
                ) : !selectedHandle ? (
                  <p className="text-sm text-muted">
                    Select a friend on the left to open your chat.
                  </p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted">
                    No messages yet. Drop the first line.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {messages.map((message) => {
                      const isMine = message.sender.id === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                              isMine
                                ? "bg-accent text-white"
                                : "border border-card-border/70 bg-white/90 text-ink"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{message.body}</p>
                            <span
                              className={`mt-2 block text-xs ${
                                isMine ? "text-white/70" : "text-muted"
                              }`}
                            >
                              {formatRelativeTime(message.createdAt)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={endRef} />
                  </div>
                )}
              </div>

              <form
                className="mt-auto space-y-3 border-t border-card-border/60 pt-4"
                onSubmit={handleSubmit}
              >
                <textarea
                  className={`${inputClasses} min-h-[90px]`}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder={
                    selectedHandle
                      ? "Drop a thought, a plan, or a hello."
                      : "Pick a friend to start typing."
                  }
                  disabled={!selectedHandle || isChatLoading}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted">
                    Messages send as {user?.handle || "you"}.
                  </p>
                  <Button
                    type="submit"
                    disabled={!selectedHandle || isSending || isChatLoading}
                  >
                    {isSending
                      ? "Sending..."
                      : selectedHandle
                        ? `Message @${selectedHandle}`
                        : "Pick a friend"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>

      <div className="mt-6 space-y-4">
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
  );
}
