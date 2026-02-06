"use client";

import { useMemo } from "react";
import type { EventWithDetails } from "@lockedin/shared";
import { getEventStatus } from "@/features/map/utils/eventHelpers";

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
}: EventsSidebarProps) => {
  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      const statusA = getEventStatus(a.start_time, a.end_time);
      const statusB = getEventStatus(b.start_time, b.end_time);

      if (statusA.urgent && !statusB.urgent) return -1;
      if (!statusA.urgent && statusB.urgent) return 1;

      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  }, [events]);

  const urgentCount = useMemo(
    () =>
      events.filter((event) =>
        getEventStatus(event.start_time, event.end_time).urgent
      ).length,
    [events]
  );

  return (
    <div className="fixed inset-0 left-0 z-40 w-full bg-white shadow-xl sm:inset-y-auto sm:top-[96px] sm:h-[calc(100vh-96px)] sm:w-[400px]">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-ink/10 bg-white p-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">
              Nearby Events ({events.length})
            </h2>
            <div className="mt-1 flex items-center gap-2">
              <p className="text-sm text-muted">{events.length} events found</p>
              {urgentCount > 0 && (
                <span className="rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-600">
                  🔴 {urgentCount} happening now
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="hidden text-sm font-semibold text-ink/60 hover:text-ink sm:block"
              title="Close sidebar"
            >
              ← Hide
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center text-2xl text-ink/50 hover:text-ink sm:hidden"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto bg-white p-3">
          {sortedEvents.length === 0 ? (
            <div className="py-12 text-center text-muted">
              <p className="mb-2 text-4xl">📍</p>
              <p>No events nearby</p>
              <p className="mt-1 text-sm">Create one to get started!</p>
            </div>
          ) : (
            sortedEvents.map((event) => {
              const status = getEventStatus(event.start_time, event.end_time);
              return (
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
                  className={`cursor-pointer rounded-2xl border border-ink/10 bg-white/90 p-3 backdrop-blur-sm transition hover:bg-white hover:shadow-md ${
                    status.urgent
                      ? "border-rose-400/60 shadow-[0_4px_12px_rgba(239,68,68,0.18)]"
                      : ""
                  }`}
                >
                  {status.label && (
                    <div
                      className={`mb-2 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold tracking-[0.08em] ${
                        status.status === "happening-now"
                          ? "bg-rose-500 text-white animate-pulse"
                          : status.status === "starting-soon"
                            ? "bg-amber-500 text-white"
                            : "bg-ink/10 text-ink/70"
                      }`}
                    >
                      {status.status === "happening-now" ? "🔴 " : ""}
                      {status.label}
                    </div>
                  )}
                <div className="mb-2 flex items-start gap-3">
                  <span className="text-3xl">
                    {CATEGORY_ICONS[event.category] ?? CATEGORY_ICONS.other}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-base font-semibold leading-tight text-ink">
                      {event.title}
                    </h3>
                    {event.venue_name && (
                      <p className="text-sm text-muted">📍 {event.venue_name}</p>
                    )}
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-2 text-sm">
                  {status.status === "happening-now" ? (
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
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
