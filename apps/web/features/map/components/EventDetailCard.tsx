"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import type { EventWithDetails } from "@lockedin/shared";
import { rsvpToEvent } from "@/lib/api/events";
import { useAuth } from "@/features/auth";
import { connectSocket, socket } from "@/lib/socket";

const CATEGORY_ICONS: Record<string, string> = {
  study: "🎓",
  social: "🎉",
  build: "💻",
  sports: "🏀",
  other: "📍",
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  return date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

type EventDetailCardProps = {
  event: EventWithDetails;
  onClose: () => void;
  onRSVP: (status: "going" | "maybe" | "declined") => void;
  onDelete?: () => Promise<void> | void;
};

export const EventDetailCard = ({
  event,
  onClose,
  onRSVP,
  onDelete,
}: EventDetailCardProps) => {
  const router = useRouter();
  const { isAuthenticated, token, user, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [userStatus, setUserStatus] = useState(event.user_status ?? null);
  const [currentView, setCurrentView] = useState<"details" | "chat">("details");
  const [chatMessages, setChatMessages] = useState<
    Array<{
      id: string;
      eventId: number;
      message: string;
      createdAt: string;
      sender: { id: string; name: string; handle?: string | null };
    }>
  >([]);
  const [chatDraft, setChatDraft] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSendingChat, setIsSendingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [modalHeight, setModalHeight] = useState<number | null>(null);

  const attendees = event.attendees ?? [];
  const isAtCapacity =
    event.max_attendees != null && event.attendee_count >= event.max_attendees;
  const categoryIcon = CATEGORY_ICONS[event.category] ?? CATEGORY_ICONS.other;
  const distanceLabel = useMemo(() => {
    if (event.distance_km == null) {
      return null;
    }
    return `${event.distance_km.toFixed(1)} km away`;
  }, [event.distance_km]);
  const canDeleteEvent = Boolean(
    user &&
      (user.isAdmin || user.id === event.creator_id || user.id === event.creator.id)
  );

  useEffect(() => {
    setUserStatus(event.user_status ?? null);
  }, [event.id, event.user_status]);

  useEffect(() => {
    setCurrentView("details");
  }, [event.id]);

  useEffect(() => {
    setChatMessages([]);
    setChatDraft("");
    setChatError(null);
  }, [event.id]);

  useEffect(() => {
    if (currentView !== "chat") {
      return;
    }
    if (!token) {
      return;
    }
    connectSocket(token);
    const handleChat = (payload: {
      eventId?: number;
      message?: {
        id: string;
        eventId: number;
        message: string;
        createdAt: string;
        sender: { id: string; name: string; handle?: string | null };
      };
    }) => {
      if (!payload?.message || payload.eventId !== event.id) {
        return;
      }
      setChatMessages((prev) => [...prev, payload.message!]);
    };
    const handleHistory = (payload: {
      eventId?: number;
      messages?: Array<{
        id: string;
        eventId: number;
        message: string;
        createdAt: string;
        sender: { id: string; name: string; handle?: string | null };
      }>;
    }) => {
      if (payload?.eventId !== event.id) {
        return;
      }
      setChatMessages(payload.messages ?? []);
    };
    socket.on("event:chat", handleChat);
    socket.on("event:chat:history", handleHistory);
    socket.emit("event:chat:history", { eventId: event.id });

    return () => {
      socket.off("event:chat", handleChat);
      socket.off("event:chat:history", handleHistory);
    };
  }, [currentView, event.id, token]);

  useEffect(() => {
    if (currentView !== "chat") {
      return;
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, currentView]);

  useEffect(() => {
    if (currentView !== "details") {
      return;
    }
    const node = modalRef.current;
    if (!node) {
      return;
    }
    const measure = () => {
      const nextHeight = node.getBoundingClientRect().height;
      if (Number.isFinite(nextHeight) && nextHeight > 0) {
        setModalHeight(nextHeight);
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(node);
    return () => observer.disconnect();
  }, [currentView, event.id]);

  const handleRSVP = async (status: "going" | "maybe" | "declined") => {
    setLoading(true);
    try {
      await rsvpToEvent(event.id, status);
      setUserStatus(status);
      onRSVP(status);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[map] RSVP failed", error);
      }
      window.alert("Failed to RSVP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChat = () => {
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }
    setCurrentView("chat");
  };

  const handleDeleteEvent = async () => {
    if (!canDeleteEvent || !onDelete || isDeleting) {
      return;
    }

    const confirmed = window.confirm(
      "Delete this event? This action cannot be undone."
    );
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("[map] delete event failed", error);
      }
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Failed to delete event. Please try again.";
      window.alert(message);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChatSubmit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault();
    if (!isAuthenticated) {
      openAuthModal("login");
      return;
    }
    const message = chatDraft.trim();
    if (!message) {
      return;
    }
    setIsSendingChat(true);
    setChatError(null);
    try {
      if (token) {
        connectSocket(token);
      }
      socket.emit("event:chat", { eventId: event.id, message });
      setChatDraft("");
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to send message."
      );
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleHostClick = () => {
    const rawHandle = event.creator.handle ?? "";
    const handleSlug = rawHandle.replace(/^@/, "").trim();
    onClose();
    if (handleSlug) {
      router.push(`/profile/${encodeURIComponent(handleSlug)}`);
      return;
    }
    if (event.creator.id) {
      router.push(`/profile/${encodeURIComponent(event.creator.id)}`);
    }
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          ref={modalRef}
          style={
            currentView === "chat" && modalHeight
              ? { height: `${modalHeight}px` }
              : undefined
          }
          className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-card-border/60 bg-white shadow-[0_24px_60px_rgba(27,26,23,0.25)] max-h-[85vh] animate-scale-in"
        >
          {currentView === "details" ? (
            <>
              <div className="sticky top-0 z-10 flex items-start justify-between border-b border-card-border/60 bg-white px-6 py-4">
                <div className="mt-6">
                  <div className="mb-2 flex items-center gap-2 text-sm text-muted">
                    <span className="text-3xl">{categoryIcon}</span>
                    <span className="capitalize">{event.category}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-semibold text-ink">{event.title}</h2>
                    {distanceLabel && (
                      <span className="text-sm text-muted whitespace-nowrap translate-y-px">
                        🚶 {distanceLabel}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-card-border/70 text-ink/60 transition hover:border-accent/40"
                  aria-label="Close"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">📅</span>
                    <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-ink">
                          Starts: {formatTime(event.start_time)}
                        </p>
                        <p className="text-sm text-muted">
                          Ends: {formatTime(event.end_time)}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                          Hosted by
                        </span>
                        <div className="flex items-center gap-3">
                          {event.creator.profile_picture_url ? (
                            <button
                              type="button"
                              onClick={handleHostClick}
                              className="flex h-10 w-10 items-center justify-center rounded-full"
                              aria-label={`View ${event.creator.handle ?? event.creator.name} profile`}
                            >
                              <img
                                src={event.creator.profile_picture_url}
                                alt={event.creator.name}
                                className="h-10 w-10 rounded-full object-cover"
                              />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={handleHostClick}
                              className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white"
                              aria-label={`View ${event.creator.handle ?? event.creator.name} profile`}
                            >
                              {event.creator.name?.charAt(0).toUpperCase() ?? "?"}
                            </button>
                          )}
                          <div>
                            <p className="text-sm font-semibold text-ink">
                              {event.creator.name}
                            </p>
                            <p className="text-xs text-muted">{event.creator.handle}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {event.venue_name && (
                    <div className="flex items-start gap-3">
                      <span className="text-xl">📍</span>
                      <p className="font-medium text-ink">{event.venue_name}</p>
                    </div>
                  )}
                </div>

                {event.description && (
                  <div>
                    <h3 className="mb-2 text-sm font-semibold text-ink">About</h3>
                    <p className="text-sm text-ink/80">{event.description}</p>
                  </div>
                )}

                <div>
                  <h3 className="mb-3 text-sm font-semibold text-ink">
                    {event.attendee_count}{" "}
                    {event.attendee_count === 1 ? "person" : "people"} going
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {attendees.slice(0, 10).map((attendee) => (
                      <div
                        key={attendee.id}
                        className="flex items-center gap-2 rounded-full bg-ink/5 px-3 py-1"
                      >
                        {attendee.profile_picture_url ? (
                          <img
                            src={attendee.profile_picture_url}
                            alt={attendee.name}
                            className="h-6 w-6 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-ink/40 text-[10px] font-semibold text-white">
                            {attendee.name?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                        )}
                        <span className="text-xs text-ink">{attendee.name}</span>
                        {attendee.checked_in && (
                          <span className="text-[10px] text-ink/50">✓</span>
                        )}
                      </div>
                    ))}
                    {event.attendee_count > 10 && (
                      <span className="text-xs text-muted">
                        +{event.attendee_count - 10} more
                      </span>
                    )}
                  </div>
                </div>

                {isAtCapacity && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                    This event is at capacity ({event.max_attendees} attendees)
                  </div>
                )}
              </div>

              <div className="sticky bottom-0 border-t border-card-border/60 bg-white px-6 py-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={handleOpenChat}
                      className="rounded-full border border-card-border/70 bg-white/90 px-3 py-1.5 text-sm font-semibold text-ink/80 transition hover:border-accent/40 hover:bg-accent/5 hover:text-ink"
                    >
                      Open chat
                    </button>
                    <div className="flex items-center gap-3">
                      {canDeleteEvent && onDelete && (
                        <button
                          type="button"
                          onClick={handleDeleteEvent}
                          disabled={isDeleting}
                          className="rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-600 transition hover:border-rose-300 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isDeleting ? "Deleting..." : "Delete event"}
                        </button>
                      )}
                      <span className="text-xs text-muted">Chat is event-only</span>
                    </div>
                  </div>
                  {userStatus && (
                    <p className="text-center text-xs text-muted">
                      You&#39;re{" "}
                      {userStatus === "going"
                        ? "✓ going"
                        : userStatus === "maybe"
                          ? "? maybe"
                          : "✗ not going"}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => handleRSVP("going")}
                      disabled={loading || (isAtCapacity && userStatus !== "going")}
                      className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        userStatus === "going"
                          ? "bg-emerald-500 text-white"
                          : "bg-ink/10 text-ink hover:bg-ink/20"
                      }`}
                    >
                      I&#39;m down
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRSVP("maybe")}
                      disabled={loading}
                      className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        userStatus === "maybe"
                          ? "bg-amber-400 text-white"
                          : "bg-ink/10 text-ink hover:bg-ink/20"
                      }`}
                    >
                      Maybe
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRSVP("declined")}
                      disabled={loading}
                      className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                        userStatus === "declined"
                          ? "bg-rose-500 text-white"
                          : "bg-ink/10 text-ink hover:bg-ink/20"
                      }`}
                    >
                      Can&#39;t make it
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="sticky top-0 z-10 grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-card-border/60 bg-white px-6 py-4">
                <button
                  type="button"
                  onClick={() => setCurrentView("details")}
                  className="text-sm font-semibold text-ink/70 transition hover:text-ink"
                >
                  ← Back
                </button>
                <div className="text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Event Chat
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">{event.title}</p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-card-border/70 text-ink/60 transition hover:border-accent/40"
                  aria-label="Close chat"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-5">
                <div className="space-y-2">
                  {chatMessages.length ? (
                    chatMessages.map((message) => {
                      const isMine = message.sender.id === user?.id;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs ${
                              isMine ? "bg-accent text-white" : "bg-ink/5 text-ink"
                            }`}
                          >
                            <p className="font-semibold">{message.sender.name}</p>
                            <p className="mt-1">{message.message}</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-muted">No messages yet.</p>
                  )}
                  <div ref={chatEndRef} />
                </div>
              </div>

              <div className="sticky bottom-0 border-t border-card-border/60 bg-white px-6 py-4">
                <form className="flex gap-2" onSubmit={handleChatSubmit}>
                  <input
                    type="text"
                    value={chatDraft}
                    onChange={(event) => setChatDraft(event.target.value)}
                    placeholder="Send a message..."
                    className="flex-1 rounded-xl border border-card-border/70 bg-white px-3 py-2 text-xs text-ink outline-none focus:border-accent/60"
                  />
                  <button
                    type="submit"
                    disabled={isSendingChat}
                    className="rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-white transition hover:bg-ink/90 disabled:opacity-70"
                  >
                    {isSendingChat ? "Sending" : "Send"}
                  </button>
                </form>
                {chatError && (
                  <p className="mt-2 text-xs font-semibold text-rose-500">
                    {chatError}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-scale-in {
          animation: scale-in 0.2s ease-out;
        }
      `}</style>
    </>,
    document.body
  );
};
