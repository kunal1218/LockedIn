"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiGet, apiPost } from "@/lib/api";
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
};

type RankedStatus =
  | { status: "idle" }
  | { status: "waiting" }
  | { status: "matched"; matchId: string; partner: MessageUser; startedAt: string };

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
  const lastMessageCountRef = useRef<number>(0);
  const timeoutReportedRef = useRef<boolean>(false);
  const progress = Math.max(0, Math.min(1, timeLeft / TURN_SECONDS));

  const loadStatus = useCallback(async () => {
    if (!token) {
      setRankedStatus({ status: "idle" });
      return;
    }

    try {
      const status = await apiGet<RankedStatus>("/ranked/status", token);
      setRankedStatus(status);
    } catch (error) {
      console.error("Ranked status error", error);
      setQueueError(error instanceof Error ? error.message : "Unable to load status.");
    }
  }, [token]);

  const loadMessages = useCallback(async () => {
    if (!token || rankedStatus.status !== "matched") {
      return;
    }
    setIsChatLoading(true);
    setChatError(null);
    try {
      const payload = await apiGet<{ messages: RankedMessage[]; timedOut: boolean }>(
        `/ranked/match/${encodeURIComponent(rankedStatus.matchId)}/messages`,
        token
      );
      if (payload.timedOut) {
        setIsTimeout(true);
        setTimeLeft(0);
        setChatError("Match ended: timer expired for this round.");
      }
      setMessages(payload.messages);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to load matched chat."
      );
      setMessages([]);
    } finally {
      setIsChatLoading(false);
    }
  }, [rankedStatus, token]);

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
      setTimeLeft(TURN_SECONDS);
      lastMessageCountRef.current = 0;
      timeoutReportedRef.current = false;
      setChatError(null);
      loadMessages();
    } else {
      setMessages([]);
      setSavedAt(null);
      setIsTimeout(false);
      setTimeLeft(TURN_SECONDS);
      lastMessageCountRef.current = 0;
      timeoutReportedRef.current = false;
      setChatError(null);
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
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to send message."
      );
    } finally {
      setIsSending(false);
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
      setSavedAt(
        payload.savedAt instanceof Date
          ? payload.savedAt.toISOString()
          : String(payload.savedAt)
      );
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to save chat.");
    } finally {
      setIsSaving(false);
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
    if (messages.length === 0 && lastMessageCountRef.current === 0) {
      setTimeLeft(TURN_SECONDS);
      setIsTimeout(false);
      return;
    }
    if (messages.length > lastMessageCountRef.current) {
      lastMessageCountRef.current = messages.length;
      setTimeLeft(TURN_SECONDS);
      setIsTimeout(false);
    }
  }, [messages, rankedStatus.status, isTimeout]);

  useEffect(() => {
    if (rankedStatus.status !== "matched" || isTimeout) {
      return;
    }
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsTimeout(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [rankedStatus.status, isTimeout]);

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
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Ranked conversation</h1>
          <p className="text-sm text-muted">
            Hit play to queue for a 1:1 chat. Each turn has 15s—if the timer hits zero, both players lose points.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {statusBadge}
          {rankedStatus.status === "waiting" ? (
            <Button variant="outline" onClick={handleCancel} disabled={isQueuing}>
              Cancel
            </Button>
          ) : (
            <Button onClick={handlePlay} disabled={isQueuing}>
              {rankedStatus.status === "matched" ? "Play again" : "Play"}
            </Button>
          )}
        </div>
      </div>

      {queueError && (
        <div className="mt-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
          {queueError}
        </div>
      )}

      <Card className="mt-6 grid min-h-[520px] grid-rows-[auto_1fr_auto] border border-card-border/70 bg-white/85 shadow-sm">
        {!isAuthenticated ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-4 text-center">
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border/60 pb-3">
              <div className="flex items-center gap-3">
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
              </div>
              {rankedStatus.status === "matched" && (
                <div className="flex w-full flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${
                        isTimeout
                          ? "bg-red-100 text-red-700"
                          : timeLeft <= 5
                            ? "bg-amber-100 text-amber-700"
                            : "bg-emerald-100 text-emerald-700"
                      }`}
                    >
                      {isTimeout ? "Timer out · both lose" : `Timer: ${timeLeft}s`}
                    </span>
                    <div className="relative h-2 w-28 overflow-hidden rounded-full bg-card-border/60">
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
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={isSaving || messages.length === 0}
                  >
                    {savedAt ? "Saved" : isSaving ? "Saving..." : "Save chat"}
                  </Button>
                  <p className="text-xs text-muted">
                    Started {formatRelativeTime(rankedStatus.startedAt)}
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto pr-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
                      Timer expired. Both players lose points for this match.
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
                </>
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
                  rankedStatus.status === "matched"
                    ? `Message ${rankedStatus.partner.handle}`
                    : "Queue up to unlock chat."
                }
                disabled={
                  rankedStatus.status !== "matched" || isChatLoading || isTimeout
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
                    isTimeout
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
      </Card>
    </div>
  );
}
