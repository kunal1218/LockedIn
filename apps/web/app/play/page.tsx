"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type DirectMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: MessageUser;
  recipient: MessageUser;
};

type RankedStatus =
  | { status: "idle" }
  | { status: "waiting" }
  | { status: "matched"; matchId: string; partner: MessageUser; startedAt: string };

const inputClasses =
  "w-full rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60 focus:bg-white";

const normalizeHandle = (handle: string) => handle.replace(/^@/, "").trim();

export default function RankedPlayPage() {
  const { isAuthenticated, token, user, openAuthModal } = useAuth();
  const [rankedStatus, setRankedStatus] = useState<RankedStatus>({ status: "idle" });
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isQueuing, setIsQueuing] = useState(false);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const partnerHandle = useMemo(() => {
    if (rankedStatus.status !== "matched") return null;
    return normalizeHandle(rankedStatus.partner.handle);
  }, [rankedStatus]);

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

  const loadMessages = useCallback(
    async (handle: string) => {
      if (!token) {
        return;
      }
      setIsChatLoading(true);
      setChatError(null);
      try {
        const payload = await apiGet<{ user: MessageUser; messages: DirectMessage[] }>(
          `/messages/with/${encodeURIComponent(handle)}`,
          token
        );
        setMessages(payload.messages);
      } catch (error) {
        setChatError(
          error instanceof Error ? error.message : "Unable to load matched chat."
        );
        setMessages([]);
      } finally {
        setIsChatLoading(false);
      }
    },
    [token]
  );

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
    if (rankedStatus.status === "matched" && partnerHandle) {
      loadMessages(partnerHandle);
    } else {
      setMessages([]);
    }
  }, [loadMessages, partnerHandle, rankedStatus.status]);

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
      if (status.status === "matched") {
        const handle = normalizeHandle(status.partner.handle);
        loadMessages(handle);
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
    if (!partnerHandle) {
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
      const response = await apiPost<{ message: DirectMessage }>(
        `/messages/with/${encodeURIComponent(partnerHandle)}`,
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

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold">Ranked conversation</h1>
          <p className="text-sm text-muted">
            Hit play to queue for a 1:1 chat. When matched, dive straight into a blank thread.
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
            <div className="flex items-center justify-between gap-3 border-b border-card-border/60 pb-3">
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
                <p className="text-xs text-muted">
                  Started {formatRelativeTime(rankedStatus.startedAt)}
                </p>
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
              ) : messages.length === 0 ? (
                <p className="text-sm text-muted">You matched! Send the first line.</p>
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
                  rankedStatus.status === "matched"
                    ? `Message ${rankedStatus.partner.handle}`
                    : "Queue up to unlock chat."
                }
                disabled={rankedStatus.status !== "matched" || isChatLoading}
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
                    rankedStatus.status !== "matched" || isSending || isChatLoading
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
