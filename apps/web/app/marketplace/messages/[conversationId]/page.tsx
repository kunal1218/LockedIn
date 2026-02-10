"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { useAuth } from "@/features/auth";
import { IMAGE_BASE_URL } from "@/lib/api";
import {
  getMarketplaceConversationMessages,
  sendMarketplaceMessage,
} from "@/lib/api/marketplace";
import type {
  MarketplaceConversation,
  MarketplaceMessage,
} from "@/features/marketplace/messages/types";
import { formatRelativeTime } from "@/lib/time";

const resolveImageUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${IMAGE_BASE_URL}${normalized}`;
};

const inputClasses =
  "w-full rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60 focus:bg-white";

export default function MarketplaceConversationPage() {
  const { token, user, isAuthenticated, openAuthModal } = useAuth();
  const params = useParams();
  const conversationId = useMemo(() => {
    const raw = (params as { conversationId?: string | string[] } | null)?.conversationId;
    if (!raw) return "";
    return Array.isArray(raw) ? raw[0] ?? "" : raw;
  }, [params]);

  const [conversation, setConversation] = useState<MarketplaceConversation | null>(null);
  const [messages, setMessages] = useState<MarketplaceMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const loadConversation = useCallback(async () => {
    if (!token || !conversationId) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const payload = await getMarketplaceConversationMessages(conversationId, token);
      setConversation(payload.conversation);
      setMessages(payload.messages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load messages.";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, token]);

  useEffect(() => {
    void loadConversation();
  }, [loadConversation]);

  useEffect(() => {
    if (!token || !conversationId) {
      return;
    }
    const interval = window.setInterval(() => {
      void loadConversation();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [conversationId, loadConversation, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      openAuthModal("login");
      return;
    }
    if (!conversationId) {
      setError("Missing conversation.");
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      setError("Write a message before sending.");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const message = await sendMarketplaceMessage(conversationId, trimmed, token);
      setMessages((prev) => [...prev, message]);
      setDraft("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to send message.";
      setError(message);
    } finally {
      setIsSending(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-4xl px-4 pb-16 pt-2">
        <div className="rounded-3xl border border-card-border/70 bg-white/80 px-6 py-10 text-center">
          <p className="mb-4 text-base text-ink">Sign in to view this conversation.</p>
          <Button requiresAuth={false} onClick={() => openAuthModal("login")}>
            Log in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Marketplace Messages</h1>
            <p className="text-sm text-muted">
              Chat about this listing with {conversation?.otherUser.name ?? "the seller"}.
            </p>
          </div>
          <Link
            href="/marketplace/messages"
            className="rounded-full border border-card-border/70 px-4 py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
          >
            Back to conversations
          </Link>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="rounded-2xl border border-card-border/70 bg-white/70 px-6 py-8 text-sm text-muted">
            Loading conversation...
          </div>
        ) : (
          <div className="rounded-3xl border border-card-border/70 bg-white/90 p-6 shadow-[0_20px_60px_rgba(30,26,22,0.08)]">
            {conversation && (
              <div className="mb-6 flex flex-wrap items-center gap-4 border-b border-card-border/60 pb-6">
                <div className="h-20 w-20 overflow-hidden rounded-2xl bg-gray-100">
                  {conversation.listing.images?.[0] ? (
                    <img
                      src={resolveImageUrl(conversation.listing.images[0])}
                      alt={conversation.listing.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-400 to-blue-600 text-xs font-semibold text-white">
                      IMG
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {conversation.listing.title}
                  </p>
                  <p className="text-xs text-muted">${conversation.listing.price}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Avatar name={conversation.otherUser.name} size={42} />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {conversation.otherUser.name}
                    </p>
                    <p className="text-xs text-muted">
                      {conversation.otherUser.handle}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex h-[60vh] min-h-[420px] flex-col gap-6">
              <div className="flex-1 overflow-y-auto pr-1">
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-muted">No messages yet.</p>
                  ) : (
                    messages.map((message) => {
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
                            <p className="whitespace-pre-wrap">{message.content}</p>
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
                    })
                  )}
                  <div ref={endRef} />
                </div>
              </div>

              <form
                className="mt-auto space-y-3 border-t border-card-border/60 pt-4"
                onSubmit={handleSubmit}
              >
                <textarea
                  className={`${inputClasses} min-h-[90px] resize-none`}
                  placeholder="Write a message"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">
                    Messages send as {user?.handle || "you"}.
                  </span>
                  <button
                    type="submit"
                    disabled={isSending}
                    className="inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(255,134,88,0.25)] transition hover:translate-y-[-1px] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSending ? "Sending..." : "Send"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
