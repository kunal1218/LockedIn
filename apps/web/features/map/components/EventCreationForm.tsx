"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { CreateEventRequest } from "@lockedin/shared";
import { Button } from "@/components/Button";

const toLocalInputValue = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

type EventCreationFormProps = {
  location: { latitude: number; longitude: number };
  onClose: () => void;
  onSubmit: (payload: CreateEventRequest) => Promise<void> | void;
};

export const EventCreationForm = ({
  location,
  onClose,
  onSubmit,
}: EventCreationFormProps) => {
  const now = useMemo(() => new Date(), []);
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000);
  const defaultEnd = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("study");
  const [venue, setVenue] = useState("");
  const [startTime, setStartTime] = useState(toLocalInputValue(defaultStart));
  const [endTime, setEndTime] = useState(toLocalInputValue(defaultEnd));
  const [maxAttendees, setMaxAttendees] = useState("");
  const [visibility, setVisibility] = useState<"public" | "friends-only">(
    "public"
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setSubmitting] = useState(false);
  const [isVisible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 20);
    return () => window.clearTimeout(timer);
  }, []);

  const validate = () => {
    if (!title.trim()) {
      return "Event title is required.";
    }

    const start = new Date(startTime);
    const end = new Date(endTime);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) {
      return "Start and end times are required.";
    }

    if (start.getTime() <= Date.now()) {
      return "Start time must be in the future.";
    }

    if (end.getTime() <= start.getTime()) {
      return "End time must be after start time.";
    }

    if (maxAttendees) {
      const parsed = Number(maxAttendees);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return "Max attendees must be a positive number.";
      }
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const payload: CreateEventRequest = {
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        latitude: location.latitude,
        longitude: location.longitude,
        venue_name: venue.trim() || undefined,
        start_time: new Date(startTime).toISOString(),
        end_time: new Date(endTime).toISOString(),
        max_attendees: maxAttendees ? Number(maxAttendees) : undefined,
        visibility,
      };

      await onSubmit(payload);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create event."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div
        className={`absolute inset-0 bg-ink/40 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full">
        <div
          className={`relative max-h-[65vh] overflow-y-auto rounded-t-[32px] border border-card-border/60 bg-[#FAF8F3] px-6 pb-24 pt-6 shadow-[0_24px_60px_rgba(27,26,23,0.25)] backdrop-blur transition-opacity duration-300 animate-slide-up ${
            isVisible ? "opacity-100" : "opacity-0"
          }`}
        >
          <div className="pb-[env(safe-area-inset-bottom)]">
            <div className="sticky top-0 z-10 -mx-6 mb-4 border-b border-card-border/60 bg-[#FAF8F3] px-6 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-ink">Create Event</h2>
                  <p className="mt-1 text-sm text-muted">
                    Pin is set at {location.latitude.toFixed(4)}, {location.longitude.toFixed(4)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-card-border/70 text-ink/70 transition hover:border-accent/40"
                  aria-label="Close"
                >
                  <span className="text-lg">×</span>
                </button>
              </div>
            </div>

            {error && (
              <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs font-semibold text-accent">
                {error}
              </div>
            )}

            <form
              id="event-create-form"
              onSubmit={handleSubmit}
              className="space-y-4"
            >
          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
              className="w-full rounded-2xl border border-card-border/60 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
              placeholder="Event title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-muted">Description</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              className="w-full resize-none rounded-2xl border border-card-border/60 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
              placeholder="Add details (optional)"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted">Category *</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                required
                className="w-full rounded-2xl border border-card-border/60 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
              >
                <option value="study">🎓 Study</option>
                <option value="social">🎉 Social</option>
                <option value="build">💻 Build</option>
                <option value="sports">🏀 Sports</option>
                <option value="other">📍 Other</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted">Venue</label>
              <input
                type="text"
                value={venue}
                onChange={(event) => setVenue(event.target.value)}
                className="w-full rounded-2xl border border-card-border/60 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
                placeholder="Memorial Union"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted">
                Start time *
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(event) => setStartTime(event.target.value)}
                required
                className="w-full rounded-2xl border border-card-border/60 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted">
                End time *
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(event) => setEndTime(event.target.value)}
                required
                className="w-full rounded-2xl border border-card-border/60 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted">
                Max attendees
              </label>
              <input
                type="number"
                min={1}
                value={maxAttendees}
                onChange={(event) => setMaxAttendees(event.target.value)}
                className="w-full rounded-2xl border border-card-border/60 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm focus:border-accent focus:outline-none"
                placeholder="Unlimited"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted">Visibility</label>
              <div className="flex items-center gap-3 rounded-2xl border border-card-border/60 bg-white/90 px-4 py-3 text-sm text-ink shadow-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="visibility"
                    value="public"
                    checked={visibility === "public"}
                    onChange={() => setVisibility("public")}
                  />
                  Public
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="visibility"
                    value="friends-only"
                    checked={visibility === "friends-only"}
                    onChange={() => setVisibility("friends-only")}
                  />
                  Friends only
                </label>
              </div>
            </div>
          </div>

          </form>
        </div>
        <div className="bg-[#FAF8F3] px-6 py-4 shadow-[0_-12px_24px_rgba(27,26,23,0.08)]">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              requiresAuth={false}
              className="min-h-[44px] flex-1"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="event-create-form"
              requiresAuth={false}
              className="min-h-[44px] flex-1"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create event"}
            </Button>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }

        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
