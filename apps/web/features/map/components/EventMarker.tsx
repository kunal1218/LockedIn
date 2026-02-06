"use client";

import type { EventWithDetails } from "@lockedin/shared";
import {
  formatEventTooltipTime,
  getCategoryColor,
  getCategoryIcon,
  getEventMarkerSize,
  getEventStatus,
  isHappeningNow,
  isStartingSoon,
} from "../utils/eventHelpers";

type EventMarkerProps = {
  event: EventWithDetails;
  isSelected?: boolean;
  onClick?: (event: EventWithDetails) => void;
  tooltip?: string;
};

export const EventMarker = ({
  event,
  isSelected,
  onClick,
  tooltip,
}: EventMarkerProps) => {
  const icon = getCategoryIcon(event.category);
  const backgroundColor = getCategoryColor(event.category);
  const count = Math.max(0, Number(event.attendee_count ?? 0));
  const size = getEventMarkerSize(event);
  const startingSoon = isStartingSoon(event);
  const happeningNow = isHappeningNow(event);
  const status = getEventStatus(event.start_time, event.end_time);
  const markerSize = status.urgent ? Math.round(size * 1.25) : size;
  const title =
    tooltip ??
    `${event.title} • ${formatEventTooltipTime(event.start_time)} • ${count} going`;

  return (
    <div
      role="button"
      aria-label={event.title}
      title={title}
      onClick={() => onClick?.(event)}
      className={`relative flex cursor-pointer items-center justify-center rounded-full text-white shadow-[0_8px_20px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
        isSelected ? "scale-110" : "hover:scale-105"
      } ${status.urgent ? "animate-pulse" : ""}`}
      style={{ backgroundColor, width: markerSize, height: markerSize }}
    >
      {startingSoon && !happeningNow && (
        <span
          className="absolute inset-0 rounded-full border-2 border-white/70 animate-ping"
          aria-hidden="true"
        />
      )}
      {happeningNow && (
        <span
          className="absolute inset-0 rounded-full ring-4 ring-white/70"
          aria-hidden="true"
        />
      )}
      {isSelected && (
        <span
          className="absolute inset-0 rounded-full ring-4 ring-white/60 shadow-[0_0_18px_rgba(255,255,255,0.55)]"
          aria-hidden="true"
        />
      )}
      <span className="text-lg" aria-hidden="true">
        {icon}
      </span>
      {count > 0 && (
        <span className="absolute -right-2 -top-2 flex min-h-[20px] min-w-[20px] items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-ink shadow-[0_2px_6px_rgba(0,0,0,0.25)]">
          {count}
        </span>
      )}
    </div>
  );
};
