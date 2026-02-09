"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiGet, apiPost } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";
import type { Club } from "@/features/clubs";

const CHANNELS = [
  { id: "general", label: "General Chat", description: "Open conversation" },
  { id: "announcements", label: "Announcements", description: "Updates from hosts" },
] as const;

type ClubChannel = (typeof CHANNELS)[number]["id"];

type ClubChatMessage = {
  id: string;
  clubId: string;
  channel: ClubChannel;
  message: string;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    handle?: string | null;
    isGuest?: boolean;
  };
};

const guestNameKey = (clubId: string) => `lockedin_guest_name_${clubId}`;

const guestAdjectives = [
  "Sunny",
  "Brisk",
  "Amber",
  "Nova",
  "Indie",
  "Hushed",
  "Silver",
  "Velvet",
  "Neon",
  "Cosmic",
];

const guestNouns = [
  "Fox",
  "Comet",
  "Pine",
  "River",
  "Atlas",
  "Meadow",
  "Cedar",
  "Orbit",
  "Breeze",
  "Echo",
];

const generateGuestName = () => {
  const adjective =
    guestAdjectives[Math.floor(Math.random() * guestAdjectives.length)];
  const noun = guestNouns[Math.floor(Math.random() * guestNouns.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${adjective} ${noun} ${suffix}`;
};

const getOrCreateGuestName = (clubId: string) => {
  if (typeof window === "undefined") {
    return "Guest";
  }
  const key = guestNameKey(clubId);
  const stored = window.localStorage.getItem(key);
  if (stored) {
    return stored;
  }
  const generated = generateGuestName();
  window.localStorage.setItem(key, generated);
  return generated;
};

const normalizeChannel = (value: string | null): ClubChannel => {
  if (value === "announcements") {
    return "announcements";
  }
  return "general";
};

export default function ClubDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const clubId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";
  const { token, user } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeChannel, setActiveChannel] = useState<ClubChannel>("general");
  const [messages, setMessages] = useState<ClubChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [isShareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const autoJoinRef = useRef(false);

  const isOwner = club?.creator?.id && user?.id === club.creator.id;
  const shouldAutoJoin =
    searchParams.get("join") === "1" || searchParams.get("join") === "true";

  useEffect(() => {
    const channelParam = searchParams.get("channel");
    setActiveChannel(normalizeChannel(channelParam));
  }, [searchParams]);

  useEffect(() => {
    autoJoinRef.current = false;
  }, [clubId]);

  useEffect(() => {
    if (!clubId) {
      return;
    }
    setIsLoading(true);
    setError(null);
    apiGet<{ club: Club }>(`/clubs/${encodeURIComponent(clubId)}`, token ?? undefined)
      .then((response) => {
        setClub(response.club ?? null);
      })
      .catch((loadError) => {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this group."
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [clubId, token]);

  useEffect(() => {
    if (!clubId || !token || !shouldAutoJoin) {
      return;
    }
    if (autoJoinRef.current || club?.joinedByUser) {
      return;
    }
    autoJoinRef.current = true;
    apiPost<{ club: Club }>(
      `/clubs/${encodeURIComponent(clubId)}/join`,
      {},
      token
    )
      .then((response) => {
        if (response.club) {
          setClub(response.club);
        }
      })
      .catch((joinError) => {
        setError(
          joinError instanceof Error
            ? joinError.message
            : "Unable to join this group."
        );
      });
  }, [club?.joinedByUser, clubId, shouldAutoJoin, token]);

  useEffect(() => {
    if (!clubId || token) {
      setGuestName(null);
      return;
    }
    setGuestName(getOrCreateGuestName(clubId));
  }, [clubId, token]);

  useEffect(() => {
    if (typeof window === "undefined" || !clubId) {
      return;
    }
    setShareUrl(
      `${window.location.origin}/clubs/${clubId}?channel=general&join=1`
    );
  }, [clubId]);

  const qrCodeSrc = useMemo(() => {
    if (!shareUrl) {
      return "";
    }
    return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
      shareUrl
    )}`;
  }, [shareUrl]);

  const fetchMessages = useCallback(
    async (options?: { silent?: boolean }) => {
      if (!clubId) {
        return;
      }
      if (!options?.silent) {
        setIsChatLoading(true);
      }
      setChatError(null);
      try {
        const response = await apiGet<{ messages: ClubChatMessage[] }>(
          `/clubs/${encodeURIComponent(clubId)}/chat?channel=${encodeURIComponent(
            activeChannel
          )}`,
          token ?? undefined
        );
        setMessages(response.messages ?? []);
      } catch (loadError) {
        if (!options?.silent) {
          setChatError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load chat messages."
          );
        }
      } finally {
        if (!options?.silent) {
          setIsChatLoading(false);
        }
      }
    },
    [activeChannel, clubId, token]
  );

  useEffect(() => {
    void fetchMessages();
    const interval = window.setInterval(() => {
      void fetchMessages({ silent: true });
    }, 4000);
    return () => window.clearInterval(interval);
  }, [fetchMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeChannel]);

  const handleSend = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatDraft.trim();
    if (!message || !clubId) {
      return;
    }
    setIsSending(true);
    setChatError(null);
    try {
      await apiPost<{ message: ClubChatMessage }>(
        `/clubs/${encodeURIComponent(clubId)}/chat`,
        {
          channel: activeChannel,
          message,
          guestName: guestName ?? undefined,
        },
        token ?? undefined
      );
      setChatDraft("");
      void fetchMessages({ silent: true });
    } catch (sendError) {
      setChatError(
        sendError instanceof Error
          ? sendError.message
          : "Unable to send that message."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleAirdrop = async () => {
    if (!shareUrl) {
      return;
    }
    setShareStatus(null);
    try {
      if (navigator.share) {
        await navigator.share({
          title: club?.title ?? "Join this group",
          text: `Join ${club?.title ?? "this group"} on LockedIn`,
          url: shareUrl,
        });
        setShareStatus("Share sheet opened.");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setShareStatus("Link copied to clipboard.");
        return;
      }
      setShareStatus("Copy the link below to share.");
    } catch (shareError) {
      setShareStatus(
        shareError instanceof Error
          ? shareError.message
          : "Unable to share that link."
      );
    }
  };

  const activeChannelMeta = CHANNELS.find((channel) => channel.id === activeChannel);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
        <Card className="py-10 text-center text-sm text-muted">
          Loading group...
        </Card>
      </div>
    );
  }

  if (error || !club) {
    return (
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
        <Card className="py-10 text-center text-sm text-muted">
          {error ?? "Group not found."}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">
            {club.title}
          </h1>
          <div className="mt-2 text-xs text-muted">{club.memberCount} members</div>
        </div>
        {isOwner && (
          <Button
            requiresAuth={false}
            onClick={() => setShareOpen(true)}
            className="h-10"
          >
            Share
          </Button>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Card className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Channels
            </p>
          </div>
          <div className="space-y-2">
            {CHANNELS.map((channel) => {
              const isActive = channel.id === activeChannel;
              return (
                <button
                  key={channel.id}
                  type="button"
                  onClick={() => setActiveChannel(channel.id)}
                  className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                    isActive
                      ? "border-accent/60 bg-accent/10 text-ink"
                      : "border-card-border/60 text-muted hover:border-accent/40 hover:text-ink"
                  }`}
                >
                  <p className="font-semibold">{channel.label}</p>
                  <p className="text-xs text-muted">{channel.description}</p>
                </button>
              );
            })}
          </div>
          {!token && guestName && (
            <div className="rounded-2xl border border-card-border/60 bg-white/80 px-4 py-3 text-xs text-muted">
              You are chatting as <span className="font-semibold text-ink">{guestName}</span>.
            </div>
          )}
        </Card>

        <Card className="flex h-[70vh] flex-col p-0">
          <div className="border-b border-card-border/60 px-6 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              {activeChannelMeta?.label ?? "Channel"}
            </p>
            <p className="text-sm text-muted">
              {activeChannelMeta?.description ?? ""}
            </p>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {isChatLoading ? (
              <p className="text-sm text-muted">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted">No messages yet.</p>
            ) : (
              messages.map((message) => (
                <div key={message.id} className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <span className="font-semibold text-ink">
                      {message.sender.handle || message.sender.name}
                    </span>
                    <span>{formatRelativeTime(message.createdAt)}</span>
                    {message.sender.isGuest && (
                      <span className="rounded-full border border-card-border/70 px-2 py-0.5 text-[10px] font-semibold text-muted">
                        Guest
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-ink">{message.message}</p>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <form
            onSubmit={handleSend}
            className="flex flex-wrap items-center gap-3 border-t border-card-border/60 px-6 py-4"
          >
            <input
              className="flex-1 rounded-2xl border border-card-border/70 bg-white/90 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
              value={chatDraft}
              onChange={(event) => setChatDraft(event.target.value)}
              placeholder={`Message ${activeChannelMeta?.label ?? "the group"}`}
              disabled={isSending}
            />
            <Button type="submit" requiresAuth={false} disabled={isSending}>
              {isSending ? "Sending..." : "Send"}
            </Button>
          </form>
          {chatError && (
            <div className="px-6 pb-4">
              <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs font-semibold text-accent">
                {chatError}
              </p>
            </div>
          )}
        </Card>
      </div>

      {isShareOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-8">
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setShareOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-lg">
              <div className="flex items-center justify-between rounded-t-[24px] border border-card-border/70 bg-white/90 px-4 py-3 md:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Share group
                  </p>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Invite to {club.title}
                  </h2>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                  onClick={() => setShareOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="rounded-b-[24px] border border-card-border/70 bg-white/95 px-6 py-5 shadow-[0_32px_80px_rgba(27,26,23,0.18)]">
                <div className="grid gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="flex items-center justify-center rounded-3xl border border-card-border/60 bg-white/80 p-4">
                    {qrCodeSrc ? (
                      <img
                        src={qrCodeSrc}
                        alt="Group QR code"
                        className="h-[200px] w-[200px]"
                      />
                    ) : (
                      <div className="h-[200px] w-[200px] rounded-2xl bg-ink/10" />
                    )}
                  </div>
                  <div className="space-y-4">
                    <p className="text-sm text-muted">
                      Anyone who scans this QR code lands in the General Chat.
                      No account required.
                    </p>
                    <div className="rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-xs text-muted">
                      {shareUrl || "Generating link..."}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        requiresAuth={false}
                        onClick={handleAirdrop}
                      >
                        Airdrop link
                      </Button>
                      <button
                        type="button"
                        className="rounded-full border border-card-border/70 px-4 py-2 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                        onClick={async () => {
                          if (!shareUrl || !navigator.clipboard) {
                            setShareStatus("Copy the link below to share.");
                            return;
                          }
                          await navigator.clipboard.writeText(shareUrl);
                          setShareStatus("Link copied to clipboard.");
                        }}
                      >
                        Copy link
                      </button>
                    </div>
                    {shareStatus && (
                      <p className="text-xs font-semibold text-muted">{shareStatus}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
