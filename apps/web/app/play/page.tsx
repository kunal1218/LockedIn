"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

type MessageUser = {
  id: string;
  name: string;
  handle: string;
};

type RankedMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: MessageUser;
  edited?: boolean;
};

type RankedStatus =
  | { status: "idle" }
  | { status: "waiting" }
  | {
      status: "matched";
      matchId: string;
      partner: MessageUser;
      startedAt: string;
      lives?: { me: number; partner: number };
      turnStartedAt?: string;
      serverTime?: string;
      isMyTurn?: boolean;
    };

const inputClasses =
  "w-full rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60 focus:bg-white";

const TURN_SECONDS = 15;

export default function RankedPlayPage() {
  const { isAuthenticated, token, user, openAuthModal } = useAuth();
  const [rankedStatus, setRankedStatus] = useState<RankedStatus>({ status: "idle" });
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isQueuing, setIsQueuing] = useState(false);
  const [messages, setMessages] = useState<RankedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isTimeout, setIsTimeout] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(TURN_SECONDS);
  const endRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const timeoutReportedRef = useRef<boolean>(false);
  const hasLoadedMessagesRef = useRef<boolean>(false);
  const justSentRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const serverTimeOffsetRef = useRef<number>(0);
  const turnStartedAtRef = useRef<string | null>(null);
  const progress = Math.max(0, Math.min(1, timeLeft / TURN_SECONDS));
  const lives =
    rankedStatus.status === "matched"
      ? rankedStatus.lives ?? { me: 3, partner: 3 }
      : null;
  const derivedIsMyTurn = useMemo(() => {
    if (!user?.id) return true;
    const last = messages[messages.length - 1];
    if (!last) return true;
    return last.sender.id !== user.id;
  }, [messages, user?.id]);
  const isMyTurn =
    rankedStatus.status === "matched"
      ? rankedStatus.isMyTurn ?? derivedIsMyTurn
      : true;
  const getRemainingSeconds = useCallback((turnStartedAt: string) => {
    const startedMs = Date.parse(turnStartedAt);
    if (!Number.isFinite(startedMs)) {
      return TURN_SECONDS;
    }
    const nowMs = Date.now() - serverTimeOffsetRef.current;
    const remainingMs = TURN_SECONDS * 1000 - (nowMs - startedMs);
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }, []);
  const syncTimer = useCallback(
    (turnStartedAt: string | null, serverTime?: string, timedOut?: boolean) => {
      if (!turnStartedAt) {
        return;
      }
      if (serverTime) {
        const serverMs = Date.parse(serverTime);
        if (Number.isFinite(serverMs)) {
          serverTimeOffsetRef.current = Date.now() - serverMs;
        }
      }
      turnStartedAtRef.current = turnStartedAt;
      if (timedOut) {
        setTimeLeft(0);
        setIsTimeout(true);
        return;
      }
      const remainingSeconds = getRemainingSeconds(turnStartedAt);
      setTimeLeft(remainingSeconds);
      setIsTimeout(remainingSeconds <= 0);
    },
    [getRemainingSeconds]
  );

  useEffect(() => {
    if (!user?.id) {
      justSentRef.current = false;
      return;
    }
    const last = messages[messages.length - 1];
    if (!last) {
      justSentRef.current = false;
      return;
    }
    justSentRef.current = last.sender.id === user.id;
  }, [messages, user?.id]);

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
        const message = messages.find((m) => m.id === selectedMessageId);
        if (message && message.sender.id === user?.id) {
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

  const loadStatus = useCallback(async () => {
    if (!token) {
      setRankedStatus({ status: "idle" });
      return;
    }

    try {
      const status = await apiGet<RankedStatus>("/ranked/status", token);
      setRankedStatus(status);
      if (status.status === "matched") {
        if (status.isMyTurn) {
          syncTimer(status.turnStartedAt ?? null, status.serverTime);
        } else {
          setTimeLeft(TURN_SECONDS);
          setIsTimeout(false);
        }
      }
    } catch (error) {
      console.error("Ranked status error", error);
      setQueueError(error instanceof Error ? error.message : "Unable to load status.");
    }
  }, [syncTimer, token]);

  const loadMessages = useCallback(async () => {
    if (!token || rankedStatus.status !== "matched") {
      return;
    }
    if (!hasLoadedMessagesRef.current) {
      setIsChatLoading(true);
    }
    setChatError(null);
    try {
      const payload = await apiGet<{
        messages: RankedMessage[];
        timedOut: boolean;
        turnStartedAt: string;
        serverTime: string;
        isMyTurn: boolean;
      }>(`/ranked/match/${encodeURIComponent(rankedStatus.matchId)}/messages`, token);
      setRankedStatus((prev) =>
        prev.status === "matched" ? { ...prev, isMyTurn: payload.isMyTurn } : prev
      );
      if (payload.isMyTurn) {
        syncTimer(payload.turnStartedAt, payload.serverTime, payload.timedOut);
      } else if (!payload.timedOut) {
        setTimeLeft(TURN_SECONDS);
        setIsTimeout(false);
      }
      if (payload.timedOut) {
        setChatError("Match ended: timer expired for this round.");
      }
      setMessages(payload.messages);
      hasLoadedMessagesRef.current = true;
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to load matched chat."
      );
      setMessages([]);
    } finally {
      setIsChatLoading(false);
    }
  }, [rankedStatus, syncTimer, token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    loadStatus();
  }, [loadStatus, token]);

  useEffect(() => {
    if (rankedStatus.status !== "waiting") {
      return;
    }

    const interval = window.setInterval(loadStatus, 3000);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadStatus, rankedStatus.status]);

  useEffect(() => {
    if (rankedStatus.status === "matched") {
      setMessages([]);
      setDraft("");
      setSavedAt(null);
      setIsTimeout(false);
      timeoutReportedRef.current = false;
      hasLoadedMessagesRef.current = false;
      justSentRef.current = false;
      setChatError(null);
      turnStartedAtRef.current = rankedStatus.turnStartedAt ?? null;
      if (rankedStatus.turnStartedAt) {
        syncTimer(rankedStatus.turnStartedAt, rankedStatus.serverTime);
      }
      loadMessages();
    } else {
      setMessages([]);
      setSavedAt(null);
      setIsTimeout(false);
      timeoutReportedRef.current = false;
      hasLoadedMessagesRef.current = false;
      justSentRef.current = false;
      setChatError(null);
      turnStartedAtRef.current = null;
    }
  }, [loadMessages, rankedStatus.status]);

  useEffect(() => {
    if (rankedStatus.status !== "matched" || isTimeout) {
      return;
    }
    const interval = window.setInterval(loadMessages, 2000);
    return () => window.clearInterval(interval);
  }, [isTimeout, loadMessages, rankedStatus.status]);

  useEffect(() => {
    if (messages.length <= 1) {
      listRef.current?.scrollTo({ top: 0 });
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const canFocus =
      rankedStatus.status === "matched" &&
      !isTimeout &&
      isMyTurn &&
      !isSending &&
      !isChatLoading;
    if (canFocus) {
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [rankedStatus.status, isTimeout, isMyTurn, isSending, isChatLoading, draft, timeLeft]);

  const handlePlay = async () => {
    if (!token) {
      openAuthModal("signup");
      return;
    }
    setIsQueuing(true);
    setQueueError(null);
    try {
      const status = await apiPost<RankedStatus>("/ranked/play", {}, token);
      setRankedStatus(status);
      if (status.status === "matched") {
        if (status.isMyTurn) {
          syncTimer(status.turnStartedAt ?? null, status.serverTime);
        } else {
          setTimeLeft(TURN_SECONDS);
          setIsTimeout(false);
        }
      }
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to join queue.");
    } finally {
      setIsQueuing(false);
    }
  };

  const handleCancel = async () => {
    if (!token) {
      openAuthModal("signup");
      return;
    }
    setIsQueuing(true);
    setQueueError(null);
    try {
      await apiPost("/ranked/cancel", {}, token);
      setRankedStatus({ status: "idle" });
      setMessages([]);
      setSavedAt(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to cancel queue.");
    } finally {
      setIsQueuing(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      openAuthModal("login");
      return;
    }
    if (!isMyTurn || justSentRef.current) {
      setChatError("Wait for your partner to reply before sending again.");
      return;
    }
    if (rankedStatus.status !== "matched") {
      setChatError("You need a match before chatting.");
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      setChatError("Write something first.");
      return;
    }
    setIsSending(true);
    setChatError(null);
    try {
      const response = await apiPost<{ message: RankedMessage }>(
        `/ranked/match/${encodeURIComponent(rankedStatus.matchId)}/messages`,
        { body: trimmed },
        token
      );
      setMessages((prev) => [...prev, response.message]);
      setDraft("");
      syncTimer(new Date(Date.now() - serverTimeOffsetRef.current).toISOString());
      justSentRef.current = true;
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to send message."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleEnterToSend = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing =
      (event.nativeEvent as unknown as { isComposing?: boolean })?.isComposing ?? false;
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !isComposing &&
      rankedStatus.status === "matched" &&
      !isTimeout &&
      isMyTurn &&
      !justSentRef.current &&
      !isSending &&
      !isChatLoading
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleSave = async () => {
    if (!token || rankedStatus.status !== "matched") {
      return;
    }
    setIsSaving(true);
    setChatError(null);
    try {
      const payload = await apiPost<{ savedAt: string }>(
        `/ranked/match/${encodeURIComponent(rankedStatus.matchId)}/save`,
        {},
        token
      );
      setSavedAt(String(payload.savedAt));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to save chat.");
    } finally {
      setIsSaving(false);
    }
  };

  const beginEditMessage = (message: RankedMessage) => {
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
    if (!editingMessageId || !token || rankedStatus.status !== "matched") return;
    const trimmed = editingDraft.trim();
    if (!trimmed) {
      setChatError("Write something to save.");
      return;
    }
    const existing = messages.find((m) => m.id === editingMessageId);
    if (existing && existing.body === trimmed) {
      setEditingMessageId(null);
      setEditingDraft("");
      return;
    }
    try {
      const response = await apiPatch<{ message: RankedMessage }>(
        `/ranked/match/${encodeURIComponent(rankedStatus.matchId)}/messages/${encodeURIComponent(editingMessageId)}`,
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
      setChatError(error instanceof Error ? error.message : "Unable to update message.");
    }
  };

  const handleDeleteMessage = async () => {
    if (!messageToDelete || !token || rankedStatus.status !== "matched") return;
    try {
      await apiDelete(
        `/ranked/match/${encodeURIComponent(rankedStatus.matchId)}/messages/${encodeURIComponent(messageToDelete)}`,
        token
      );
      setMessages((prev) => prev.filter((msg) => msg.id !== messageToDelete));
      if (editingMessageId === messageToDelete) {
        setEditingMessageId(null);
        setEditingDraft("");
      }
      setSelectedMessageId(null);
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to delete message.");
    } finally {
      setMessageToDelete(null);
    }
  };

  const statusBadge = (() => {
    switch (rankedStatus.status) {
      case "waiting":
        return (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
            Searching for a partner...
          </span>
        );
      case "matched":
        return (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
            Matched!
          </span>
        );
      default:
        return (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Idle
          </span>
        );
    }
  })();

  useEffect(() => {
    if (rankedStatus.status !== "matched") {
      return;
    }
    const timer = window.setInterval(() => {
      if (!turnStartedAtRef.current) {
        return;
      }
      if (!isMyTurn) {
        setTimeLeft(TURN_SECONDS);
        return;
      }
      const remainingSeconds = getRemainingSeconds(turnStartedAtRef.current);
      setTimeLeft(remainingSeconds);
      if (remainingSeconds <= 0) {
        setIsTimeout(true);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [getRemainingSeconds, isMyTurn, rankedStatus.status]);

  useEffect(() => {
    if (
      rankedStatus.status !== "matched" ||
      !isTimeout ||
      !token ||
      timeoutReportedRef.current
    ) {
      return;
    }
    timeoutReportedRef.current = true;
    apiPost(
      `/ranked/match/${encodeURIComponent(rankedStatus.matchId)}/timeout`,
      {},
      token
    ).catch(() => {
      // swallow timeout reporting errors
    });
  }, [isTimeout, rankedStatus, token]);

  return (
    <div className="mx-auto h-[calc(100vh-80px)] max-w-6xl overflow-hidden px-4 pb-6 pt-6">
      <Card className="grid h-full min-h-[520px] grid-rows-[auto_1fr_auto] gap-3 overflow-hidden border border-card-border/70 bg-white/85 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {rankedStatus.status === "matched" ? (
              <Avatar name={rankedStatus.partner.name} size={44} />
            ) : (
              <div className="h-11 w-11 rounded-full bg-card-border/60" />
            )}
            <div>
              <p className="text-sm font-semibold text-ink">
                {rankedStatus.status === "matched"
                  ? rankedStatus.partner.name
                  : "Waiting for a match"}
              </p>
              <p className="text-xs text-muted">
                {rankedStatus.status === "matched"
                  ? rankedStatus.partner.handle
                  : "Queue to get paired with someone new."}
              </p>
            </div>
            {rankedStatus.status === "matched" && lives && (
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    isTimeout
                      ? "bg-red-100 text-red-700"
                      : timeLeft <= 5
                        ? "bg-amber-100 text-amber-700"
                        : "bg-emerald-100 text-emerald-700"
                  }`}
                >
                  {isTimeout ? "Timer expired · turn missed" : `Timer: ${timeLeft}s`}
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  You: {lives.me} lives
                </span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                  {rankedStatus.partner.handle}: {lives.partner} lives
                </span>
                <div className="flex items-center gap-2">
                  <div className="relative h-2 w-32 overflow-hidden rounded-full bg-card-border/60">
                    <div
                      className={`h-full ${
                        isTimeout
                          ? "bg-red-500"
                          : timeLeft <= 5
                            ? "bg-amber-500"
                            : "bg-accent"
                      } transition-[width] duration-300`}
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted">
                    Started {formatRelativeTime(rankedStatus.startedAt)}
                  </p>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusBadge}
            {rankedStatus.status === "waiting" ? (
              <Button variant="outline" onClick={handleCancel} disabled={isQueuing}>
                Cancel
              </Button>
            ) : rankedStatus.status === "matched" && !isTimeout ? (
              <Button
                variant="outline"
                disabled
                requiresAuth={false}
                className="pointer-events-none"
              >
                In match
              </Button>
            ) : (
              <Button onClick={handlePlay} disabled={isQueuing}>
                {rankedStatus.status === "matched" ? "Play again" : "Play"}
              </Button>
            )}
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="row-span-2 flex flex-col items-center justify-center space-y-4 text-center">
            <p className="text-base font-semibold text-ink">
              Log in to play ranked conversation.
            </p>
            <p className="text-sm text-muted">
              We need your profile to pair you with someone.
            </p>
            <Button requiresAuth={false} onClick={() => openAuthModal("login")}>
              Log in
            </Button>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-col">
              {queueError && (
                <div className="mb-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
                  {queueError}
                </div>
              )}
              <div
                ref={listRef}
                className="min-h-0 flex-1 overflow-y-auto pr-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
              {rankedStatus.status !== "matched" ? (
                <div className="flex h-full flex-col items-center justify-center space-y-3 text-center">
                  <p className="text-base font-semibold text-ink">Blank chat.</p>
                  <p className="text-sm text-muted">
                    Press play to start looking for a partner. We will drop them here once matched.
                  </p>
                </div>
              ) : isChatLoading ? (
                <p className="text-sm text-muted">Loading chat...</p>
              ) : (
                <>
                  {isTimeout && (
                    <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700">
                      {isMyTurn
                        ? "Timer expired. You missed your turn."
                        : `Timer expired. ${rankedStatus.partner.handle} missed their turn.`}
                    </div>
                  )}
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted">
                      You matched! The 15s timer is running — send the first line.
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
                                    className={`w-full resize-none bg-transparent text-current outline-none ${
                                      isMine ? "placeholder-white/80" : "placeholder-ink/50"
                                    }`}
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
                </>
              )}
            </div>
            </div>

            <form
              className="mt-auto space-y-3 border-t border-card-border/60 pt-4"
              onSubmit={handleSubmit}
            >
              <textarea
                className={`${inputClasses} min-h-[90px]`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleEnterToSend}
                placeholder={
                  rankedStatus.status === "matched"
                    ? `Message ${rankedStatus.partner.handle}`
                    : "Queue up to unlock chat."
                }
                ref={inputRef}
                disabled={
                  rankedStatus.status !== "matched" || isChatLoading || isTimeout
                  || !isMyTurn
                }
              />
              {chatError && (
                <div className="rounded-2xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
                  {chatError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">
                  Messages send as {user?.handle || "you"}.
                </p>
                <Button
                  type="submit"
                  disabled={
                    rankedStatus.status !== "matched" ||
                    isSending ||
                    isChatLoading ||
                    isTimeout ||
                    !isMyTurn
                  }
                >
                  {isSending
                    ? "Sending..."
                    : rankedStatus.status === "matched"
                      ? "Send"
                      : "Play to chat"}
                </Button>
              </div>
            </form>
          </>
        )}
        {messageToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-sm rounded-2xl border border-card-border/70 bg-white/90 p-5 shadow-lg">
              <p className="text-base font-semibold text-ink">Delete message?</p>
              <p className="mt-2 text-sm text-muted">
                This message will be removed for both players.
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
      </Card>
    </div>
  );
}
