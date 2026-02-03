"use client";

import { useMemo } from "react";
import type { EventWithDetails } from "@lockedin/shared";

const CATEGORY_ICONS: Record<string, string> = {
  study: "🎓",
  social: "🎉",
  build: "💻",
  sports: "🏀",
  other: "📍",
};

const CATEGORY_COLORS: Record<string, string> = {
  study: "bg-blue-100 text-blue-700",
  social: "bg-purple-100 text-purple-700",
  build: "bg-green-100 text-green-700",
  sports: "bg-orange-100 text-orange-700",
  other: "bg-gray-100 text-gray-700",
};

const formatTime = (isoString: string) => {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 0) return "Happening now";
  if (diffMins < 60) return `In ${diffMins} mins`;
  if (diffHours < 24) return `In ${diffHours} hours`;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const isHappeningNow = (event: EventWithDetails) => {
  const now = new Date();
  return now >= new Date(event.start_time) && now <= new Date(event.end_time);
};

type EventsSidebarProps = {
  events: EventWithDetails[];
  onClose: () => void;
  onEventClick: (eventId: number) => void;
  userLocation: { latitude: number; longitude: number } | null;
};

export const EventsSidebar = ({
  events,
  onClose,
  onEventClick,
  userLocation: _userLocation,
}: EventsSidebarProps) => {
  const sortedEvents = useMemo(() => {
    return [...events].sort(
      (a, b) =>
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [events]);

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 top-24 z-40 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed right-0 top-24 z-50 flex h-[calc(100%-96px)] w-full flex-col bg-white shadow-2xl sm:w-96 animate-slide-in-right">
        <div className="flex items-center justify-between border-b border-ink/10 p-6">
          <div>
            <h2 className="text-2xl font-bold text-ink">Nearby Events</h2>
            <p className="text-sm text-muted">{events.length} events found</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center text-2xl text-ink/50 hover:text-ink"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          {sortedEvents.length === 0 ? (
            <div className="py-12 text-center text-muted">
              <p className="mb-2 text-4xl">📍</p>
              <p>No events nearby</p>
              <p className="mt-1 text-sm">Create one to get started!</p>
            </div>
          ) : (
            sortedEvents.map((event) => (
              <div
                key={event.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onEventClick(event.id);
                  onClose();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onEventClick(event.id);
                    onClose();
                  }
                }}
                className="cursor-pointer rounded-2xl border border-ink/10 bg-white p-4 transition hover:shadow-md"
              >
                <div className="mb-2 flex items-start gap-3">
                  <span className="text-3xl">
                    {CATEGORY_ICONS[event.category] ?? CATEGORY_ICONS.other}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold leading-tight text-ink">
                      {event.title}
                    </h3>
                    {event.venue_name && (
                      <p className="text-sm text-muted">📍 {event.venue_name}</p>
                    )}
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-2 text-sm">
                  {isHappeningNow(event) ? (
                    <span className="rounded bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700">
                      HAPPENING NOW
                    </span>
                  ) : (
                    <span className="text-muted">📅 {formatTime(event.start_time)}</span>
                  )}
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium capitalize ${
                      CATEGORY_COLORS[event.category] ?? CATEGORY_COLORS.other
                    }`}
                  >
                    {event.category}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-sm text-muted">
                  <span>👥</span>
                  <span>
                    {event.attendee_count} {event.attendee_count === 1 ? "person" : "people"} going
                  </span>
                  {event.max_attendees && (
                    <span className="text-xs text-muted/70">/ {event.max_attendees} max</span>
                  )}
                </div>

                {event.distance_km != null && (
                  <div className="mt-1 text-xs text-muted/70">
                    🚶 {event.distance_km.toFixed(1)} km away
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </>
  );
};
