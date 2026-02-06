import type { EventWithDetails } from "@lockedin/shared";

const CATEGORY_ICONS: Record<string, string> = {
  study: "🎓",
  social: "🎉",
  build: "💻",
  sports: "🏀",
  other: "📍",
};

const CATEGORY_COLORS: Record<string, string> = {
  study: "#3b82f6",
  social: "#a855f7",
  build: "#10b981",
  sports: "#f97316",
  other: "#6b7280",
};

export const getCategoryIcon = (category: string) =>
  CATEGORY_ICONS[category] ?? CATEGORY_ICONS.other;

export const getCategoryColor = (category: string) =>
  CATEGORY_COLORS[category] ?? CATEGORY_COLORS.other;

export const isStartingSoon = (event: EventWithDetails) => {
  const startTime = new Date(event.start_time);
  const now = new Date();
  const diffMs = startTime.getTime() - now.getTime();
  const hours = diffMs / (1000 * 60 * 60);
  return hours > 0 && hours < 1;
};

export const isHappeningNow = (event: EventWithDetails) => {
  const now = new Date();
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  return now >= start && now <= end;
};

export const getEventMarkerSize = (event: EventWithDetails) => {
  const count = Math.max(0, Number(event.attendee_count ?? 0));
  return 40 + Math.min(20, count);
};

export const getEventStatus = (startTime: string, endTime: string) => {
  const now = new Date();
  const start = new Date(startTime);
  const end = new Date(endTime);
  const minutesUntilStart = Math.floor(
    (start.getTime() - now.getTime()) / (1000 * 60)
  );

  if (now >= start && now <= end) {
    return {
      status: "happening-now",
      label: "HAPPENING NOW",
      urgent: true,
    };
  }

  if (minutesUntilStart > 0 && minutesUntilStart <= 30) {
    return {
      status: "starting-soon",
      label: `STARTS IN ${minutesUntilStart} MIN`,
      urgent: true,
    };
  }

  if (now > end) {
    return {
      status: "ended",
      label: "ENDED",
      urgent: false,
    };
  }

  return {
    status: "upcoming",
    label: null,
    urgent: false,
  };
};

const isSameDay = (left: Date, right: Date) =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

export const formatEventTooltipTime = (timestamp: string) => {
  const date = new Date(timestamp);
  const now = new Date();
  const timeLabel = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isSameDay(date, now)) {
    return `Today at ${timeLabel}`;
  }

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (isSameDay(date, tomorrow)) {
    return `Tomorrow at ${timeLabel}`;
  }

  const dateLabel = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${dateLabel} at ${timeLabel}`;
};
