import type { MapEvent } from "@lockedin/shared";

export const events: MapEvent[] = [
  {
    id: "event-1",
    title: "Sunset picnic club",
    location: "Hilltop Lawn",
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(),
    category: "social",
    attendees: 14,
    vibe: "low-key",
  },
  {
    id: "event-2",
    title: "Founders brainstorm",
    location: "Innovation Hub",
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 4).toISOString(),
    category: "build",
    attendees: 9,
    vibe: "high-energy",
  },
  {
    id: "event-3",
    title: "Open mic chaos",
    location: "Student Union",
    startsAt: new Date(Date.now() + 1000 * 60 * 60 * 5).toISOString(),
    category: "creative",
    attendees: 22,
    vibe: "playful",
  },
];
