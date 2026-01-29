"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export type RequestComposerPayload = {
  title: string;
  description: string;
  city: string | null;
  isRemote: boolean;
  urgency: "low" | "medium" | "high";
};

type RequestComposerProps = {
  onSubmit: (payload: RequestComposerPayload) => Promise<void> | void;
  isSaving?: boolean;
  disabled?: boolean;
};

const labelClasses =
  "text-xs font-semibold uppercase tracking-[0.2em] text-muted";
const inputClasses =
  "w-full rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

export const RequestComposer = ({
  onSubmit,
  isSaving = false,
  disabled = false,
}: RequestComposerProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<RequestComposerPayload["urgency"]>("low");
  const [city, setCity] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    (isRemote || city.trim().length > 0) &&
    !isSaving &&
    !disabled;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Add a title, description, and a city or mark it remote.");
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        city: isRemote ? null : city.trim(),
        isRemote,
        urgency,
      });
      setTitle("");
      setDescription("");
      setUrgency("low");
      setCity("");
      setIsRemote(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to post request.");
    }
  };

  const handleLocate = () => {
    if (disabled || isLocating) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Geolocation not available.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const approx = `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
        setCity(approx);
        setIsLocating(false);
        setError(null);
      },
      (geoError) => {
        setIsLocating(false);
        setError(geoError.message || "Unable to detect location.");
      },
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
    );
  };

  return (
    <Card className="space-y-4 border border-card-border/70 bg-white/80 shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Post a request
        </p>
        <p className="text-sm text-muted">
          Share what you need help with so others can jump in fast.
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className={labelClasses}>Title</span>
          <input
            className={inputClasses}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Need a hand with..."
            disabled={disabled}
            required
          />
        </label>
        <label className="block space-y-2">
          <span className={labelClasses}>Description</span>
          <textarea
            className={`${inputClasses} min-h-[100px]`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Give a quick rundown so helpers know what's up."
            disabled={disabled}
            required
          />
        </label>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className={labelClasses}>City</span>
            <input
              className={inputClasses}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="City for in-person meetups"
              disabled={disabled || isRemote}
              required={!isRemote}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
              <button
                type="button"
                className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink disabled:opacity-60"
                onClick={handleLocate}
                disabled={disabled || isRemote || isLocating}
              >
                {isLocating ? "Detecting..." : "Use my location"}
              </button>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-card-border/70 text-accent focus:ring-accent/40"
                  checked={isRemote}
                  onChange={(event) => setIsRemote(event.target.checked)}
                  disabled={disabled}
                />
                Remote request
              </label>
            </div>
          </label>

          <label className="block space-y-2">
            <span className={labelClasses}>Urgency</span>
            <select
              className={`${inputClasses} appearance-none`}
              value={urgency}
              onChange={(event) =>
                setUrgency(event.target.value as RequestComposerPayload["urgency"])
              }
              disabled={disabled}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>

        {error && (
          <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit || isSaving} requiresAuth={false}>
            {isSaving ? "Posting..." : "Post request"}
          </Button>
        </div>
      </form>
    </Card>
  );
};
