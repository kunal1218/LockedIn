"use client";

import type { PointerEvent } from "react";
import { useRef, useState } from "react";
import { Button } from "@/components/Button";
import { Tag } from "@/components/Tag";
import { formatEventTime } from "@/lib/time";
import { events } from "../mock";

const EXPANDED_HEIGHT = "70vh";
const COLLAPSED_HEIGHT = 72;
const SWIPE_THRESHOLD = 40;

export const EventDrawer = () => {
  const [isOpen, setOpen] = useState(false);
  const startYRef = useRef<number | null>(null);

  const handleToggle = () => {
    setOpen((prev) => !prev);
  };

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    startYRef.current = event.clientY;
  };

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    if (startYRef.current == null) {
      return;
    }
    const delta = event.clientY - startYRef.current;
    startYRef.current = null;

    if (Math.abs(delta) > SWIPE_THRESHOLD) {
      setOpen(delta < 0);
      return;
    }

    handleToggle();
  };

  const handlePointerCancel = () => {
    startYRef.current = null;
  };

  const translateY = isOpen
    ? "translateY(0px)"
    : `translateY(calc(${EXPANDED_HEIGHT} - ${COLLAPSED_HEIGHT}px))`;

  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-ink/30 backdrop-blur-sm transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
        <div
          className="pointer-events-auto w-full px-4 pb-4 transition-transform duration-300 will-change-transform"
          style={{ height: EXPANDED_HEIGHT, transform: translateY }}
        >
          <div className="flex h-full flex-col rounded-t-[32px] border border-card-border/60 bg-white/90 shadow-[0_24px_60px_rgba(27,26,23,0.2)] backdrop-blur transition-transform duration-300">
            <button
              type="button"
              className="flex items-center justify-between gap-4 px-5 py-4"
              onClick={handleToggle}
              onPointerDown={handlePointerDown}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerCancel}
            >
              <div className="text-left">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  Nearby events
                </p>
                <p className="text-sm text-ink/70">Pick a vibe and show up.</p>
              </div>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full border border-card-border/70 text-ink/60 transition ${
                  isOpen ? "rotate-180" : "rotate-0"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </span>
            </button>
            <div className="-mt-2 flex justify-center">
              <div className="h-1.5 w-12 rounded-full bg-ink/15" />
            </div>
            <div
              className="mt-4 space-y-4 overflow-y-auto px-5 pb-6"
              style={{ maxHeight: `calc(${EXPANDED_HEIGHT} - 120px)` }}
            >
              {events.map((event) => (
                <div
                  key={event.id}
                  className="space-y-4 rounded-3xl border border-card-border/60 bg-white/90 p-4 shadow-[0_16px_30px_rgba(27,26,23,0.08)] backdrop-blur"
                >
                  <div className="flex items-center justify-between">
                    <Tag tone="mint">{event.category}</Tag>
                    <span className="text-xs text-muted">
                      {formatEventTime(event.startsAt)}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-lg font-semibold text-ink">{event.title}</h4>
                    <p className="text-sm text-muted">{event.location}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted">
                      {event.attendees} people | {event.vibe}
                    </span>
                    <Button variant="outline">I am down</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
