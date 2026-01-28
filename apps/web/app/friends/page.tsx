"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
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
  edited?: boolean;
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
const LAST_HANDLE_KEY = "friends:lastHandle";

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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "remove" | "block";
    handle: string;
    displayHandle: string;
  } | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const initializedSelectionRef = useRef(false);

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
    if (!summary || initializedSelectionRef.current) {
      return;
    }
    initializedSelectionRef.current = true;
    const handles = summary.friends.map((friend) => normalizeHandle(friend.handle));
    const stored =
      typeof window !== "undefined"
        ? normalizeHandle(localStorage.getItem(LAST_HANDLE_KEY) ?? "")
        : "";
    const firstHandle = handles[0] ?? null;
    if (stored && handles.includes(stored)) {
      setSelectedHandle(stored);
    } else if (firstHandle) {
      setSelectedHandle(firstHandle);
    }
  }, [summary]);

  useEffect(() => {
    if (!summary) return;
    if (
      selectedHandle &&
      !summary.friends.some(
        (friend) => normalizeHandle(friend.handle) === selectedHandle
      )
    ) {
      const fallback = summary.friends[0]?.handle
        ? normalizeHandle(summary.friends[0].handle)
        : null;
      setSelectedHandle(fallback ?? null);
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
    setEditingMessageId(null);
    setEditingDraft("");
    setSelectedMessageId(null);

    apiGet<ThreadResponse>(`/messages/with/${encodeURIComponent(selectedHandle)}`, token)
      .then((payload) => {
        if (!isActive) {
          return;
        }
        setThreadUser(payload.user);
        setMessages(payload.messages);
        if (typeof window !== "undefined") {
          localStorage.setItem(LAST_HANDLE_KEY, selectedHandle);
        }
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
    if (messages.length <= 1) {
      listRef.current?.scrollTo({ top: 0 });
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedHandle) {
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [selectedHandle]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selectedMessageId) {
        const target = messages.find((message) => message.id === selectedMessageId);
        if (target && target.sender.id === user?.id) {
          setMessageToDelete(selectedMessageId);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [messages, selectedMessageId, user?.id]);

  useEffect(() => {
    if (editingMessageId) {
      window.setTimeout(() => {
        editInputRef.current?.focus();
      }, 0);
    }
  }, [editingMessageId]);

  const handleEnterToSend = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing =
      (event.nativeEvent as unknown as { isComposing?: boolean })?.isComposing ?? false;
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !isComposing &&
      !isSending &&
      !isChatLoading &&
      selectedHandle
    ) {
      event.preventDefault();
      const form = event.currentTarget.form;
      form?.requestSubmit();
    }
  };

  const handleCancelRequest = async (handle: string) => {
    if (!token) {
      openAuthModal();
      return;
    }
    await apiDelete(`/friends/requests/with/${encodeURIComponent(handle)}`, token);
    refreshSummary();
  };

  const performRemove = async (handle: string) => {
    if (!token) {
      openAuthModal();
      return;
    }
    await apiDelete(`/friends/${encodeURIComponent(handle)}`, token);
    refreshSummary();
  };

  const performBlock = async (handle: string) => {
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
    const normalized = normalizeHandle(handle);
    setSelectedHandle(normalized);
    setChatError(null);
    setEditingMessageId(null);
    setEditingDraft("");
    setSelectedMessageId(null);
    if (typeof window !== "undefined") {
      localStorage.setItem(LAST_HANDLE_KEY, normalized);
    }
    window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const confirmRemove = (handle: string) => {
    setConfirmAction({
      type: "remove",
      handle,
      displayHandle: normalizeHandle(handle),
    });
  };

  const confirmBlock = (handle: string) => {
    setConfirmAction({
      type: "block",
      handle,
      displayHandle: normalizeHandle(handle),
    });
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }
    const targetHandle = confirmAction.handle;
    setIsConfirmingAction(true);
    try {
      if (confirmAction.type === "remove") {
        await performRemove(targetHandle);
        if (confirmAction.displayHandle === selectedHandle) {
          setSelectedHandle(null);
          setThreadUser(null);
          setMessages([]);
        }
      } else {
        await performBlock(targetHandle);
      }
      setConfirmAction(null);
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const beginEditMessage = (message: DirectMessage) => {
    if (message.sender.id !== user?.id) return;
    setEditingMessageId(message.id);
    setEditingDraft(message.body);
    setSelectedMessageId(message.id);
  };

  const cancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingDraft("");
  };

  const saveEditedMessage = async () => {
    if (!editingMessageId || !token) return;
    const trimmed = editingDraft.trim();
    if (!trimmed) {
      setChatError("Write something to save.");
      return;
    }
    const current = messages.find((msg) => msg.id === editingMessageId);
    if (current && current.body === trimmed) {
      setEditingMessageId(null);
      setEditingDraft("");
      return;
    }
    try {
      const response = await apiPatch<{ message: DirectMessage }>(
        `/messages/${encodeURIComponent(editingMessageId)}`,
        { body: trimmed },
        token
      );
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === editingMessageId ? { ...response.message, edited: true } : msg
        )
      );
      setEditingMessageId(null);
      setEditingDraft("");
      setChatError(null);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to update message."
      );
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete || !token) return;
    try {
      await apiDelete(`/messages/${encodeURIComponent(messageToDelete)}`, token);
      setMessages((prev) => prev.filter((msg) => msg.id !== messageToDelete));
      setSelectedMessageId(null);
      if (editingMessageId === messageToDelete) {
        setEditingMessageId(null);
        setEditingDraft("");
      }
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to delete message."
      );
    } finally {
      setMessageToDelete(null);
    }
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
      setChatError(null);
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

  const selectedFriend =
    summary?.friends.find(
      (friend) => normalizeHandle(friend.handle) === selectedHandle
    ) ?? null;

  return (
    <div className="mx-auto h-[calc(100vh-80px)] max-w-6xl overflow-hidden px-4 pb-6 pt-10">
      <div className="grid h-full min-h-0 grid-cols-[200px_minmax(0,_1fr)] items-start gap-4 lg:gap-6">
        <Card className="flex h-full min-h-[520px] flex-col overflow-hidden border border-card-border/70 bg-white/80 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-3">
            <div>
              <h2 className="font-display text-lg font-semibold">Direct messages</h2>
            </div>
            {!isAuthenticated ? (
              <Button onClick={() => openAuthModal("signup")}>
                Join
              </Button>
            ) : null}
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
            <div className="mt-3 flex-1 overflow-y-auto overflow-x-hidden space-y-1 pr-1">
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
                    className={`group flex min-h-[68px] items-center gap-3 rounded-xl border px-3 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-accent/40 ${
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
                    <Avatar name={friend.name} size={42} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-ink truncate">
                        {friend.handle.slice(0, 18)}
                      </p>
                      <p className="text-xs text-muted">
                        {collegeLabel ? `${collegeLabel}` : "Campus member"}
                      </p>
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

        <Card className="flex h-full min-h-[520px] flex-col overflow-hidden border border-card-border/70 bg-white/80 shadow-sm">
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
                      onClick={() => confirmRemove(selectedFriend.handle)}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className={actionClasses}
                      onClick={() => confirmBlock(selectedFriend.handle)}
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

              <div
                ref={listRef}
                className="flex-1 min-h-0 overflow-y-auto pr-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
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
                      const isEditing = editingMessageId === message.id;
                      const isSelected = selectedMessageId === message.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            onClick={() => setSelectedMessageId(message.id)}
                            onDoubleClick={() => beginEditMessage(message)}
                            className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                              isMine
                                ? "bg-accent text-white"
                                : "border border-card-border/70 bg-white/90 text-ink"
                            } ${isSelected ? "ring-2 ring-accent/40" : ""}`}
                          >
                            {isEditing ? (
                              <div className="flex flex-col gap-1">
                                <textarea
                                  ref={editInputRef}
                                  className={`w-full resize-none bg-transparent text-current outline-none ${isMine ? "placeholder-white/80" : "placeholder-ink/50"}`}
                                  value={editingDraft}
                                  onChange={(e) => setEditingDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      saveEditedMessage();
                                    } else if (e.key === "Escape") {
                                      e.preventDefault();
                                      cancelEditMessage();
                                    }
                                  }}
                                  rows={1}
                                />
                                <div
                                  className={`flex items-center gap-2 text-xs ${
                                    isMine ? "text-white/70" : "text-muted"
                                  }`}
                                >
                                  <span>{formatRelativeTime(message.createdAt)}</span>
                                  {message.edited && <span>· edited</span>}
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="whitespace-pre-wrap">{message.body}</p>
                                <div
                                  className={`mt-2 flex items-center gap-2 text-xs ${
                                    isMine ? "text-white/70" : "text-muted"
                                  }`}
                                >
                                  <span>{formatRelativeTime(message.createdAt)}</span>
                                  {message.edited && <span>· edited</span>}
                                </div>
                              </>
                            )}
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
                className={`${inputClasses} min-h-[72px]`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleEnterToSend}
                ref={inputRef}
                placeholder={
                  selectedHandle
                    ? "Drop a thought, a plan, or a hello."
                    : "Pick a friend to start typing."
                }
                disabled={!selectedHandle || isSending}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">
                  Messages send as {user?.handle || "you"}.
                </p>
                <Button
                  type="submit"
                  disabled={
                    !selectedHandle ||
                    isSending ||
                    isChatLoading
                  }
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

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-card-border/70 bg-white/90 p-5 shadow-lg">
            <p className="text-base font-semibold text-ink">Are you sure?</p>
            <p className="mt-2 text-sm text-muted">
              {confirmAction.type === "remove"
                ? `Remove @${confirmAction.displayHandle} from your friends list?`
                : `Block @${confirmAction.displayHandle}? You will not receive messages from them.`}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-card-border/70 px-4 py-2 text-xs font-semibold text-muted transition hover:border-accent/50 hover:text-ink"
                onClick={() => {
                  if (isConfirmingAction) return;
                  setConfirmAction(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(255,134,88,0.25)] transition hover:translate-y-[-1px]"
                onClick={handleConfirmAction}
                disabled={isConfirmingAction}
              >
                {isConfirmingAction
                  ? "Working..."
                  : confirmAction.type === "remove"
                    ? "Yes, remove"
                    : "Yes, block"}
              </button>
            </div>
          </div>
        </div>
      )}
      {messageToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-card-border/70 bg-white/90 p-5 shadow-lg">
            <p className="text-base font-semibold text-ink">Delete message?</p>
            <p className="mt-2 text-sm text-muted">
              This message will be removed for both participants.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full border border-card-border/70 px-4 py-2 text-xs font-semibold text-muted transition hover:border-accent/50 hover:text-ink"
                onClick={() => setMessageToDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(255,134,88,0.25)] transition hover:translate-y-[-1px]"
                onClick={handleDeleteMessage}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
