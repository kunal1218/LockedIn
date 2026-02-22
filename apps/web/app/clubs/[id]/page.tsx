"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
type ClubViewTab = "about" | "events" | "officers";
type ClubInsightTab = "constitution" | "points";

type ClubViewTabMeta = {
  id: ClubViewTab;
  label: string;
};

type ClubInsightTabMeta = {
  id: ClubInsightTab;
  label: string;
};

type UpcomingClubEvent = {
  id: string;
  title: string;
  startsAt: Date;
  location: string;
  details: string;
};

type OfficerProfile = {
  id: string;
  name: string;
  subtitle: string;
};

const CLUB_VIEW_TABS: ClubViewTabMeta[] = [
  { id: "about", label: "About" },
  { id: "events", label: "Events" },
  { id: "officers", label: "Officers" },
];

const CLUB_INSIGHT_TABS: ClubInsightTabMeta[] = [
  { id: "constitution", label: "Constitution" },
  { id: "points", label: "Points" },
];

const CATEGORY_LABELS: Record<Club["category"], string> = {
  social: "Social / Recreational",
  study: "Study Sessions",
  build: "Build Projects",
  sports: "Sports",
  creative: "Creative",
  wellness: "Wellness",
};

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

const getTimestamp = (value: string) => {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getInitials = (value: string) =>
  value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

const getClubLocation = (club: Club) => {
  if (club.isRemote) {
    return "Remote";
  }
  return club.city ? `${club.city} · ${club.location}` : club.location;
};

const nextWeekdayAt = (
  reference: Date,
  weekday: number,
  hour: number,
  minute: number
) => {
  const result = new Date(reference);
  result.setSeconds(0, 0);
  const offset = (weekday - result.getDay() + 7) % 7;
  result.setDate(result.getDate() + offset);
  result.setHours(hour, minute, 0, 0);
  if (result.getTime() <= reference.getTime()) {
    result.setDate(result.getDate() + 7);
  }
  return result;
};

const formatEventMoment = (value: Date) =>
  value.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const buildUpcomingEvents = (club: Club): UpcomingClubEvent[] => {
  const now = new Date();
  const baseLocation = club.isRemote
    ? "Remote · Live room shared in chat"
    : `${club.location}${club.city ? `, ${club.city}` : ""}`;

  return [
    {
      id: `${club.id}-weekly`,
      title: `${club.title} Weekly Meetup`,
      startsAt: nextWeekdayAt(now, 1, 18, 30),
      location: baseLocation,
      details:
        club.joinPolicy === "application"
          ? "Priority seating for approved members"
          : "Open drop-in session",
    },
    {
      id: `${club.id}-workshop`,
      title: `${club.title} Skill Sprint`,
      startsAt: nextWeekdayAt(now, 4, 17, 0),
      location: baseLocation,
      details: "Hands-on workshop led by officers",
    },
    {
      id: `${club.id}-social`,
      title: `${club.title} Weekend Hangout`,
      startsAt: nextWeekdayAt(now, 6, 11, 0),
      location: club.isRemote
        ? "Remote lounge"
        : `${club.city ?? "Campus"} common area`,
      details: "Bring a friend and invite new members",
    },
  ].sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
};

export default function ClubDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const clubId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";
  const { token, user, openAuthModal } = useAuth();
  const [club, setClub] = useState<Club | null>(null);
  const [clubFeed, setClubFeed] = useState<Club[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ClubViewTab>("about");
  const [activeInsightTab, setActiveInsightTab] =
    useState<ClubInsightTab>("constitution");
  const [activeChannel, setActiveChannel] = useState<ClubChannel>("general");
  const [messages, setMessages] = useState<ClubChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isMembershipLoading, setIsMembershipLoading] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [isShareOpen, setShareOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [shareStatus, setShareStatus] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const autoJoinRef = useRef(false);

  const isOwner = Boolean(club?.creator?.id && user?.id === club.creator.id);
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
    let isActive = true;
    setIsFeedLoading(true);
    apiGet<{ clubs: Club[] }>("/clubs", token ?? undefined)
      .then((response) => {
        if (!isActive) {
          return;
        }
        setClubFeed(response.clubs ?? []);
      })
      .catch(() => {
        if (isActive) {
          setClubFeed([]);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsFeedLoading(false);
        }
      });
    return () => {
      isActive = false;
    };
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

  useEffect(() => {
    chatInputRef.current?.focus();
  }, [activeChannel]);

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
          text: `Join ${club?.title ?? "this group"} on QuadBlitz`,
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

  const handleMembershipAction = useCallback(async () => {
    if (!clubId || !club) {
      return;
    }
    if (!token) {
      openAuthModal("signup");
      return;
    }
    if (club.joinPolicy === "application" && club.applicationStatus === "pending") {
      return;
    }
    setIsMembershipLoading(true);
    setError(null);
    try {
      const endpoint = club.joinedByUser ? "leave" : "join";
      const response = await apiPost<{ club: Club }>(
        `/clubs/${encodeURIComponent(clubId)}/${endpoint}`,
        {},
        token
      );
      if (response.club) {
        setClub(response.club);
      }
    } catch (membershipError) {
      setError(
        membershipError instanceof Error
          ? membershipError.message
          : "Unable to update membership."
      );
    } finally {
      setIsMembershipLoading(false);
    }
  }, [club, clubId, openAuthModal, token]);

  const activeChannelMeta = CHANNELS.find((channel) => channel.id === activeChannel);
  const feedClubs = useMemo(() => {
    const byId = new Map<string, Club>();
    if (club) {
      byId.set(club.id, club);
    }
    clubFeed.forEach((entry) => byId.set(entry.id, entry));
    return [...byId.values()]
      .sort((a, b) => getTimestamp(b.createdAt) - getTimestamp(a.createdAt))
      .slice(0, 8);
  }, [club, clubFeed]);
  const subClubCandidates = useMemo(() => {
    if (!club) {
      return [];
    }

    const byId = new Map<string, Club>();

    clubFeed
      .filter((entry) => entry.id !== club.id && entry.category === club.category)
      .forEach((entry) => byId.set(entry.id, entry));

    clubFeed
      .filter((entry) => entry.id !== club.id && entry.joinedByUser)
      .forEach((entry) => {
        if (!byId.has(entry.id)) {
          byId.set(entry.id, entry);
        }
      });

    return [...byId.values()]
      .sort((a, b) => {
        const joinedDelta =
          Number(Boolean(b.joinedByUser)) - Number(Boolean(a.joinedByUser));
        if (joinedDelta !== 0) {
          return joinedDelta;
        }

        const categoryDelta =
          Number(b.category === club.category) -
          Number(a.category === club.category);
        if (categoryDelta !== 0) {
          return categoryDelta;
        }

        return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
      })
      .slice(0, 6);
  }, [club, clubFeed]);
  const joinedSubClubCount = useMemo(
    () => subClubCandidates.filter((entry) => entry.joinedByUser).length,
    [subClubCandidates]
  );
  const recentPosts = useMemo(() => messages.slice(-6).reverse(), [messages]);
  const upcomingEvents = useMemo(
    () => (club ? buildUpcomingEvents(club) : []),
    [club]
  );
  const officerProfiles = useMemo<OfficerProfile[]>(() => {
    if (!club) {
      return [];
    }
    const roster = new Map<string, OfficerProfile>();
    roster.set(club.creator.id, {
      id: club.creator.id,
      name: club.creator.name,
      subtitle: "Founder",
    });

    messages
      .filter((message) => !message.sender.isGuest)
      .forEach((message) => {
        if (roster.size >= 5 || roster.has(message.sender.id)) {
          return;
        }
        roster.set(message.sender.id, {
          id: message.sender.id,
          name: message.sender.name,
          subtitle: message.sender.handle ?? "Officer",
        });
      });

    const placeholderRoles = [
      "Community Lead",
      "Events Lead",
      "Ops Lead",
      "Member Success",
    ];

    let index = 0;
    while (roster.size < 5) {
      const fallbackId = `placeholder-${index}`;
      roster.set(fallbackId, {
        id: fallbackId,
        name: `Open Seat ${index + 1}`,
        subtitle: placeholderRoles[index % placeholderRoles.length],
      });
      index += 1;
    }

    return [...roster.values()].slice(0, 5);
  }, [club, messages]);
  const pointsTotal = useMemo(() => {
    if (!club) {
      return 0;
    }
    const base = club.memberCount * 4 + messages.length * 3;
    const policyBonus = club.joinPolicy === "application" ? 12 : 6;
    return Math.max(25, base + policyBonus);
  }, [club, messages.length]);
  const eventContributorMultiplier = useMemo(
    () => Math.max(1, Math.round(pointsTotal / 55)),
    [pointsTotal]
  );
  const membershipLabel = useMemo(() => {
    if (!club) {
      return "Join Group";
    }
    if (isMembershipLoading) {
      if (club.joinedByUser) {
        return "Leaving...";
      }
      return club.joinPolicy === "application" ? "Sending..." : "Joining...";
    }
    if (club.joinedByUser) {
      return "Leave Group";
    }
    if (club.joinPolicy === "application") {
      if (club.applicationStatus === "pending") {
        return "Request Pending";
      }
      if (club.applicationStatus === "denied") {
        return "Reapply";
      }
      return "Request to Join";
    }
    return "Join Group";
  }, [club, isMembershipLoading]);
  const canPreviewPosts = Boolean(
    club?.joinedByUser || isOwner || club?.joinPolicy === "open"
  );
  const showPostsPanel = activeView !== "events";
  const showEventsPanel = activeView !== "officers";

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-2">
        <Card className="py-10 text-center text-sm text-muted">
          Loading group...
        </Card>
      </div>
    );
  }

  if (!club) {
    return (
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-2">
        <Card className="py-10 text-center text-sm text-muted">
          {error ?? "Group not found."}
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-2">
      <div className="grid gap-6 xl:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden xl:block">
          <Card className="sticky top-24 space-y-4 p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-3 text-[10px] font-bold text-white">
                QB
              </div>
              <p className="text-sm font-semibold text-ink">Community Feed</p>
            </div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
              Most Recent
            </p>
            {isFeedLoading ? (
              <p className="text-xs text-muted">Loading groups...</p>
            ) : (
              <div className="space-y-2">
                {feedClubs.map((entry) => {
                  const isActiveClub = entry.id === club.id;
                  return (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() =>
                        router.push(`/clubs/${encodeURIComponent(entry.id)}`)
                      }
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2 text-left transition ${
                        isActiveClub
                          ? "border-accent/40 bg-accent/10"
                          : "border-card-border/50 bg-white/70 hover:border-accent/30 hover:bg-white"
                      }`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent-2/70 to-accent-3/60 text-xs font-semibold text-ink">
                        {getInitials(entry.title) || "G"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {entry.title}
                        </p>
                        <p className="truncate text-[11px] text-muted">
                          {entry.city ?? entry.location}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </aside>

        <div className="space-y-5">
          <Card className="overflow-hidden p-0">
            <div className="h-1.5 w-full bg-gradient-to-r from-accent via-accent-3 to-accent-2" />
            <div className="space-y-6 p-5 md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-card-border/70 bg-gradient-to-br from-accent-4 via-white to-accent-3/50">
                    {club.imageUrl ? (
                      <img
                        src={club.imageUrl}
                        alt={club.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-lg font-semibold text-ink/80">
                        {getInitials(club.title)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-display text-2xl font-semibold text-ink md:text-3xl">
                      {club.title}
                    </h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full border border-card-border/70 bg-white/85 px-3 py-1 font-semibold text-ink/90">
                        {CATEGORY_LABELS[club.category]}
                      </span>
                      <span className="rounded-full border border-card-border/70 bg-white/85 px-3 py-1 text-muted">
                        {club.memberCount} members
                      </span>
                      <span className="rounded-full border border-card-border/70 bg-white/85 px-3 py-1 text-muted">
                        {getClubLocation(club)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {!isOwner && (
                    <button
                      type="button"
                      onClick={handleMembershipAction}
                      disabled={
                        isMembershipLoading ||
                        (club.joinPolicy === "application" &&
                          club.applicationStatus === "pending")
                      }
                      className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                        club.joinedByUser
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : club.joinPolicy === "application" &&
                              club.applicationStatus === "pending"
                            ? "cursor-not-allowed border-amber-300 bg-amber-100 text-amber-800"
                            : "border-card-border/70 bg-white/85 text-muted hover:border-accent/45 hover:text-ink"
                      }`}
                    >
                      {membershipLabel}
                    </button>
                  )}
                  {isOwner && (
                    <Button
                      requiresAuth={false}
                      onClick={() => setShareOpen(true)}
                      className="h-10"
                    >
                      Share invite
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-b border-card-border/60 pb-3">
                {CLUB_VIEW_TABS.map((tab) => {
                  const isActive = tab.id === activeView;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveView(tab.id)}
                      className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                        isActive
                          ? "bg-ink text-white"
                          : "text-muted hover:bg-white/85 hover:text-ink"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-3">
                <p className="text-sm leading-relaxed text-muted">
                  {club.description}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="rounded-full border border-card-border/70 bg-white/80 px-3 py-1">
                    Created {formatRelativeTime(club.createdAt)}
                  </span>
                  <span className="rounded-full border border-card-border/70 bg-white/80 px-3 py-1">
                    {club.joinPolicy === "application"
                      ? "Application based"
                      : "Open membership"}
                  </span>
                  <span className="rounded-full border border-card-border/70 bg-white/80 px-3 py-1">
                    {activeChannelMeta?.label ?? "General Chat"}
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-ink">Officers</p>
                <div className="flex flex-wrap items-start gap-3">
                  {officerProfiles.map((officer, index) => (
                    <div key={officer.id} className="w-[92px] space-y-1 text-center">
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full border border-card-border/70 bg-gradient-to-br from-white via-accent-4/50 to-accent-3/40 text-xs font-semibold text-ink">
                        {getInitials(officer.name) || `${index + 1}`}
                      </div>
                      <p className="truncate text-[11px] font-semibold text-ink">
                        {officer.name}
                      </p>
                      <p className="truncate text-[10px] text-muted">
                        {officer.subtitle}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-0">
            <div className="flex items-center gap-5 border-b border-card-border/60 px-5 py-3">
              {CLUB_INSIGHT_TABS.map((tab) => {
                const isActive = tab.id === activeInsightTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveInsightTab(tab.id)}
                    className={`relative pb-1 text-sm font-semibold transition ${
                      isActive
                        ? "text-ink after:absolute after:bottom-0 after:left-0 after:h-0.5 after:w-full after:bg-ink"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-4">
              {activeInsightTab === "constitution" ? (
                <div className="space-y-2 text-sm text-muted">
                  <p className="font-semibold text-ink">Group Constitution</p>
                  <p>
                    {club.title} focuses on consistent meetups, open collaboration,
                    and accountable leadership. Respectful behavior and active
                    participation are expected.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    {club.title} has a total of{" "}
                    <span className="font-semibold text-ink">{pointsTotal}</span>{" "}
                    points.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full border border-card-border/70 bg-accent/10 px-3 py-1 font-semibold text-ink">
                      Event Contributor x{eventContributorMultiplier}
                    </span>
                    <span className="rounded-full border border-card-border/70 bg-white/80 px-3 py-1 text-muted">
                      Community Replies x{Math.max(1, Math.ceil(messages.length / 3))}
                    </span>
                    <span className="rounded-full border border-card-border/70 bg-white/80 px-3 py-1 text-muted">
                      Member Growth x{Math.max(1, Math.ceil(club.memberCount / 20))}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card-border/60 px-5 py-4">
              <div>
                <h2 className="font-display text-xl font-semibold text-ink">
                  College Organizations
                </h2>
                <p className="text-xs text-muted">
                  Global hub for this club. Open any chapter page from here.
                </p>
              </div>
              <span className="rounded-full border border-card-border/70 bg-white/85 px-3 py-1 text-[11px] font-semibold text-muted">
                {joinedSubClubCount} joined
              </span>
            </div>
            <div className="space-y-2 px-5 py-4">
              {subClubCandidates.length === 0 ? (
                <p className="text-sm text-muted">
                  No linked organizations yet. As users join chapters, they will
                  appear here.
                </p>
              ) : (
                subClubCandidates.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-card-border/60 bg-white/75 px-3 py-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-card-border/70 bg-gradient-to-br from-white via-accent-4/60 to-accent-3/50 text-xs font-semibold text-ink">
                        {getInitials(entry.title) || "C"}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">
                          {entry.title}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {entry.city ?? entry.location}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.joinedByUser && (
                        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                          Joined
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/clubs/${encodeURIComponent(entry.id)}`)
                        }
                        className="rounded-full border border-card-border/70 bg-white/90 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                      >
                        Open page
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {!token && guestName && (
            <Card className="border border-card-border/70 bg-white/85 py-3">
              <p className="text-xs text-muted">
                You are chatting as{" "}
                <span className="font-semibold text-ink">{guestName}</span> in
                public drop-in mode.
              </p>
            </Card>
          )}

          {error && (
            <Card className="border border-accent/30 bg-accent/10 py-3">
              <p className="text-sm font-semibold text-accent">{error}</p>
            </Card>
          )}

          <div
            className={`grid gap-5 ${
              showPostsPanel && showEventsPanel ? "lg:grid-cols-2" : ""
            }`}
          >
            {showPostsPanel && (
              <Card className="flex flex-col p-0">
                <div className="border-b border-card-border/60 px-5 py-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="font-display text-xl font-semibold text-ink">
                      Latest Officer Posts
                    </h2>
                    <span className="rounded-full border border-card-border/70 bg-white/80 px-3 py-1 text-[11px] font-semibold text-muted">
                      {activeChannelMeta?.label ?? "Channel"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {CHANNELS.map((channel) => {
                      const isActive = channel.id === activeChannel;
                      return (
                        <button
                          key={channel.id}
                          type="button"
                          onClick={() => setActiveChannel(channel.id)}
                          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                            isActive
                              ? "border-accent/60 bg-accent/10 text-ink"
                              : "border-card-border/60 bg-white/75 text-muted hover:border-accent/35 hover:text-ink"
                          }`}
                        >
                          {channel.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {!canPreviewPosts ? (
                  <div className="space-y-3 px-5 py-10 text-center">
                    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-2xl border border-card-border/70 bg-white/90 text-muted">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-5 w-5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="4" y="10" width="16" height="10" rx="2" />
                        <path d="M8 10V7a4 4 0 1 1 8 0v3" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-ink">
                      Join this group to unlock officer posts.
                    </p>
                    {!isOwner && (
                      <button
                        type="button"
                        onClick={handleMembershipAction}
                        disabled={isMembershipLoading}
                        className="rounded-full border border-card-border/70 bg-white/90 px-4 py-2 text-xs font-semibold text-muted transition hover:border-accent/45 hover:text-ink"
                      >
                        {membershipLabel}
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="min-h-[220px] max-h-[340px] space-y-4 overflow-y-auto px-5 py-4">
                      {isChatLoading ? (
                        <p className="text-sm text-muted">Loading posts...</p>
                      ) : recentPosts.length === 0 ? (
                        <p className="text-sm text-muted">
                          No posts yet. Start the first thread.
                        </p>
                      ) : (
                        recentPosts.map((message) => (
                          <article
                            key={message.id}
                            className="rounded-2xl border border-card-border/60 bg-white/75 p-3"
                          >
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
                            <p className="mt-1 text-sm text-ink">{message.message}</p>
                          </article>
                        ))
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <form
                      onSubmit={handleSend}
                      className="flex flex-wrap items-center gap-3 border-t border-card-border/60 px-5 py-4"
                    >
                      <input
                        ref={chatInputRef}
                        className="flex-1 rounded-2xl border border-card-border/70 bg-white/90 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20"
                        value={chatDraft}
                        onChange={(event) => setChatDraft(event.target.value)}
                        placeholder={`Message ${activeChannelMeta?.label ?? "the group"}`}
                        disabled={isSending}
                        autoFocus
                      />
                      <Button
                        type="submit"
                        requiresAuth={false}
                        disabled={isSending}
                      >
                        {isSending ? "Sending..." : "Post"}
                      </Button>
                    </form>
                  </>
                )}
                {chatError && (
                  <div className="px-5 pb-4">
                    <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs font-semibold text-accent">
                      {chatError}
                    </p>
                  </div>
                )}
              </Card>
            )}

            {showEventsPanel && (
              <Card className="p-0">
                <div className="flex items-center justify-between border-b border-card-border/60 px-5 py-4">
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Upcoming Events
                  </h2>
                  <button
                    type="button"
                    className="text-xs font-semibold text-muted transition hover:text-ink"
                  >
                    View all
                  </button>
                </div>
                <div className="space-y-3 px-5 py-4">
                  {upcomingEvents.map((event) => (
                    <article
                      key={event.id}
                      className="rounded-2xl border border-card-border/60 bg-white/75 p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {event.title}
                          </p>
                          <p className="text-xs text-muted">
                            {formatEventMoment(event.startsAt)}
                          </p>
                        </div>
                        <span className="rounded-full border border-card-border/70 bg-white/90 px-2.5 py-1 text-[10px] font-semibold text-muted">
                          RSVP
                        </span>
                      </div>
                      <div className="mt-2 space-y-1 text-xs text-muted">
                        <p>{event.location}</p>
                        <p>{event.details}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
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
