"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/Button";
import { useAuth } from "@/features/auth";
import { getMarketplaceConversations } from "@/lib/api/marketplace";
import { IMAGE_BASE_URL } from "@/lib/api";
import type { MarketplaceConversation } from "@/features/marketplace/messages/types";
import { formatRelativeTime } from "@/lib/time";

const resolveImageUrl = (url: string) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const normalized = url.startsWith("/") ? url : `/${url}`;
  return `${IMAGE_BASE_URL}${normalized}`;
};

export default function MarketplaceMessagesPage() {
  const { token, isAuthenticated, openAuthModal } = useAuth();
  const [conversations, setConversations] = useState<MarketplaceConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!token) {
      setConversations([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMarketplaceConversations(token);
      setConversations(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load messages.";
      setError(message);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="rounded-3xl border border-card-border/70 bg-white/80 px-6 py-10 text-center shadow-[0_20px_60px_rgba(30,26,22,0.08)]">
          <h1 className="font-display text-3xl font-semibold text-ink">Marketplace Messages</h1>
          <p className="mt-3 text-sm text-muted">
            Sign in to chat with buyers and sellers about listings.
          </p>
          <Button
            className="mt-6"
            onClick={() => openAuthModal("login")}
            requiresAuth={false}
          >
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold text-ink">Marketplace Messages</h1>
          <p className="mt-2 text-base text-gray-600">
            Conversations tied to the listings you care about.
          </p>
        </div>
        <Link
          href="/marketplace"
          className="inline-flex items-center justify-center rounded-full border border-card-border bg-white/80 px-4 py-2 text-sm font-semibold text-ink transition hover:border-accent/60"
        >
          Back to Marketplace
        </Link>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-2xl border border-card-border/70 bg-white/70 px-6 py-8 text-sm text-muted">
          Loading marketplace conversations...
        </div>
      ) : conversations.length === 0 ? (
        <div className="rounded-2xl border border-card-border/70 bg-white/70 px-6 py-12 text-center">
          <p className="text-gray-500">No marketplace conversations yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {conversations.map((conversation) => {
            const image = conversation.listing.images?.[0];
            const imageUrl = image ? resolveImageUrl(image) : "";
            const lastMessage =
              conversation.lastMessage?.content ?? "Start the conversation.";
            return (
              <Link
                key={conversation.id}
                href={`/marketplace/messages/${conversation.id}`}
                className="flex items-center gap-4 rounded-2xl border border-card-border/70 bg-white/80 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="h-16 w-16 overflow-hidden rounded-xl bg-gray-100">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
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
                    {conversation.otherUser.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {conversation.listing.title} · ${conversation.listing.price}
                  </p>
                  <p className="mt-1 truncate text-xs text-gray-400">{lastMessage}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs text-gray-400">
                    {formatRelativeTime(conversation.updatedAt)}
                  </span>
                  {conversation.unreadCount > 0 && (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-semibold text-white">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
