"use client";

import { useEffect, useMemo, useState } from "react";
import type { EventWithDetails } from "@lockedin/shared";
import { getEventStatus } from "@/features/map/utils/eventHelpers";

const CATEGORIES = [
  { id: "all", label: "All", icon: "🎯" },
  { id: "study", label: "Study", icon: "🎓" },
  { id: "social", label: "Social", icon: "🎉" },
  { id: "build", label: "Build", icon: "💻" },
  { id: "sports", label: "Sports", icon: "⚽" },
  { id: "food", label: "Food", icon: "🍕" },
  { id: "other", label: "Other", icon: "✨" },
] as const;

const CATEGORY_ICONS: Record<string, string> = {
  study: "🎓",
  social: "🎉",
  build: "💻",
  sports: "🏀",
  food: "🍕",
  other: "📍",
};

const CATEGORY_COLORS: Record<string, string> = {
  study: "bg-blue-100 text-blue-700",
  social: "bg-purple-100 text-purple-700",
  build: "bg-green-100 text-green-700",
  sports: "bg-orange-100 text-orange-700",
  food: "bg-amber-100 text-amber-700",
  other: "bg-gray-100 text-gray-700",
};

const CATEGORY_MAP: Record<string, string> = {
  study: "study",
  academic: "study",
  social: "social",
  party: "social",
  build: "build",
  hack: "build",
  sports: "sports",
  athletics: "sports",
  food: "food",
  dining: "food",
  other: "other",
};

const normalizeCategory = (value?: string | null) => {
  const cleaned = value?.toLowerCase().trim() ?? "other";
  return CATEGORY_MAP[cleaned] ?? cleaned;
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
  now?: Date;
};

export const EventsSidebar = ({
  events,
  onClose,
  onEventClick,
  now,
}: EventsSidebarProps) => {
  const currentTime = now ?? new Date();
  const [selectedCategory, setSelectedCategory] = useState("all");

  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key < "1" || event.key > String(CATEGORIES.length)) {
        return;
      }
      const index = Number(event.key) - 1;
      const category = CATEGORIES[index];
      if (category) {
        setSelectedCategory(category.id);
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, []);

  const filteredEvents = useMemo(() => {
    if (selectedCategory === "all") {
      return events;
    }
    return events.filter(
      (event) => normalizeCategory(event.category) === selectedCategory
    );
  }, [events, selectedCategory]);

  const categoryCounts = useMemo(() => {
    return events.reduce<Record<string, number>>((acc, event) => {
      const category = normalizeCategory(event.category);
      acc[category] = (acc[category] ?? 0) + 1;
      return acc;
    }, {});
  }, [events]);

  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const statusA = getEventStatus(a.start_time, a.end_time);
      const statusB = getEventStatus(b.start_time, b.end_time);

      if (statusA.status === "happening-now" && statusB.status !== "happening-now") {
        return -1;
      }
      if (statusA.status !== "happening-now" && statusB.status === "happening-now") {
        return 1;
      }

      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });
  }, [filteredEvents]);

  const liveCount = useMemo(
    () =>
      filteredEvents.filter(
        (event) =>
          getEventStatus(event.start_time, event.end_time).status === "happening-now"
      ).length,
    [filteredEvents]
  );

  return (
    <div className="fixed inset-0 left-0 z-40 w-full bg-white shadow-xl sm:inset-y-auto sm:top-[96px] sm:h-[calc(100vh-96px)] sm:w-[400px]">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between border-b border-ink/10 bg-white p-4">
          <div>
            <h2 className="text-xl font-bold text-ink">Nearby Events</h2>
            <div className="mt-1 text-sm text-muted">
              {filteredEvents.length} events
              {liveCount > 0 && (
                <span className="ml-2 inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  <span className="font-medium text-rose-600">{liveCount} live</span>
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
        <style>{`
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        <div className="border-b border-ink/10 bg-white px-4 py-3">
          <div
            className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
            style={{ scrollbarWidth: "none" }}
          >
            {CATEGORIES.map((category) => {
              const isActive = selectedCategory === category.id;
              const count =
                category.id === "all"
                  ? events.length
                  : categoryCounts[category.id] ?? 0;
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-orange-500 text-white shadow-sm"
                      : "bg-ink/5 text-ink/70 hover:bg-ink/10"
                  }`}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                  {category.id !== "all" && isActive && (
                    <span className="text-xs opacity-90">({count})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {selectedCategory !== "all" && (
          <div className="border-b border-orange-100 bg-orange-50 px-4 py-2 text-sm text-orange-700">
            Showing {filteredEvents.length} {selectedCategory} events
            <button
              type="button"
              onClick={() => setSelectedCategory("all")}
              className="ml-2 font-medium text-orange-600 hover:text-orange-700"
            >
              Clear ✕
            </button>
          </div>
        )}

        <div className="flex-1 space-y-2 overflow-y-auto bg-white p-3">
          {sortedEvents.length === 0 ? (
            <div className="py-12 text-center text-muted">
              <p className="mb-2 text-4xl">🔍</p>
              <p className="font-medium text-ink/70">
                No{" "}
                {selectedCategory === "all"
                  ? "events"
                  : `${selectedCategory} events`}{" "}
                nearby
              </p>
              <p className="mt-1 text-sm">Try a different category.</p>
            </div>
          ) : (
            sortedEvents.map((event) => {
              const status = getEventStatus(event.start_time, event.end_time);
              const minutesUntilStart = Math.floor(
                (new Date(event.start_time).getTime() - currentTime.getTime()) /
                  (1000 * 60)
              );
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
                  className={`relative cursor-pointer rounded-2xl border border-ink/10 bg-white/90 p-4 backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md ${
                    status.status === "happening-now"
                      ? "border-rose-300/70 bg-gradient-to-r from-rose-500/[0.03] to-white"
                      : ""
                  }`}
                >
                  {status.status === "happening-now" && (
                    <span className="absolute -left-1 top-0 h-full w-1 rounded-l-lg bg-gradient-to-b from-rose-500 to-rose-600" />
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
                    {status.status === "happening-now" && (
                      <div className="mt-1 flex items-center gap-1.5 text-xs font-medium text-rose-600">
                        <span className="inline-flex h-2 w-2 rounded-full bg-rose-500" />
                        <span>Live now</span>
                      </div>
                    )}
                    {status.status === "starting-soon" && minutesUntilStart > 0 && (
                      <div className="mt-1 text-xs font-medium text-amber-600">
                        Starts in {minutesUntilStart} min
                      </div>
                    )}
                  </div>
                </div>

                <div className="mb-2 flex items-center gap-2 text-sm">
                  <span className="text-muted">📅 {formatTime(event.start_time)}</span>
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
