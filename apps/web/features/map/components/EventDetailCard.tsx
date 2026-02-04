"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventWithDetails } from "@lockedin/shared";
import { rsvpToEvent } from "@/lib/api/events";

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
};

export const EventDetailCard = ({
  event,
  onClose,
  onRSVP,
}: EventDetailCardProps) => {
  const [loading, setLoading] = useState(false);
  const [userStatus, setUserStatus] = useState(event.user_status ?? null);

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

  useEffect(() => {
    setUserStatus(event.user_status ?? null);
  }, [event.id, event.user_status]);

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

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-card-border/60 bg-white shadow-[0_24px_60px_rgba(27,26,23,0.25)] max-h-[85vh] animate-scale-in">
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-card-border/60 bg-white px-6 py-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm text-muted">
              <span className="text-3xl">{categoryIcon}</span>
              <span className="capitalize">{event.category}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold text-ink">{event.title}</h2>
              {distanceLabel && (
                <span className="text-sm text-muted whitespace-nowrap">
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
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <p className="font-medium text-ink">
                    Starts: {formatTime(event.start_time)}
                  </p>
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Hosted by
                  </span>
                </div>
                <p className="text-sm text-muted">
                  Ends: {formatTime(event.end_time)}
                </p>
              </div>
            </div>
            {event.venue_name && (
              <div className="flex items-start gap-3">
                <span className="text-xl">📍</span>
                <p className="font-medium text-ink">{event.venue_name}</p>
              </div>
            )}
            {distanceLabel && (
              <div className="flex items-start gap-3">
                <span className="text-xl">🚶</span>
                <p className="text-sm text-muted">{distanceLabel}</p>
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
            <div className="flex items-center gap-3">
              {event.creator.profile_picture_url ? (
                <img
                  src={event.creator.profile_picture_url}
                  alt={event.creator.name}
                  className="h-10 w-10 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-white">
                  {event.creator.name?.charAt(0).toUpperCase() ?? "?"}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-ink">
                  {event.creator.name}
                </p>
                <p className="text-xs text-muted">{event.creator.handle}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="mb-3 text-sm font-semibold text-ink">
              {event.attendee_count} {event.attendee_count === 1 ? "person" : "people"} going
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
            {userStatus && (
              <p className="text-center text-xs text-muted">
                You&#39;re {userStatus === "going"
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
    </div>
  );
};
