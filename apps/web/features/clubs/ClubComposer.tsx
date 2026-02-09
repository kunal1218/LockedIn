"use client";

import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import type { ClubCategory, ClubComposerPayload } from "./types";

type ClubComposerProps = {
  onSubmit: (payload: ClubComposerPayload) => Promise<void> | void;
  isSaving?: boolean;
  disabled?: boolean;
};

const labelClasses =
  "text-xs font-semibold uppercase tracking-[0.2em] text-muted";
const inputClasses =
  "w-full rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

const categoryOptions: Array<{ label: string; value: ClubCategory }> = [
  { label: "Social", value: "social" },
  { label: "Study", value: "study" },
  { label: "Build", value: "build" },
  { label: "Sports", value: "sports" },
  { label: "Creative", value: "creative" },
  { label: "Wellness", value: "wellness" },
];

export const ClubComposer = ({
  onSubmit,
  isSaving = false,
  disabled = false,
}: ClubComposerProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<ClubCategory>("social");
  const [city, setCity] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
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
      setError("Add a name, description, and a city or mark it remote.");
      return;
    }
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        category,
        city: isRemote ? null : city.trim(),
        isRemote,
        imageUrl,
      });
      setTitle("");
      setDescription("");
      setCategory("social");
      setCity("");
      setIsRemote(false);
      setImageUrl(null);
      setImageName(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create club.");
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageUrl(null);
      setImageName(null);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      if (result) {
        setImageUrl(result);
        setImageName(file.name);
        setError(null);
      }
    };
    reader.onerror = () => setError("Unable to read that image.");
    reader.readAsDataURL(file);
  };

  return (
    <Card className="space-y-4 border border-card-border/70 bg-white/80 shadow-sm">
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
          Start a club
        </p>
        <p className="text-sm text-muted">
          Make it official. Share the vibe and let people join instantly.
        </p>
      </div>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <label className="block space-y-2">
          <span className={labelClasses}>Club name</span>
          <input
            className={inputClasses}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Late-night chess club"
            disabled={disabled}
            required
          />
        </label>
        <label className="block space-y-2">
          <span className={labelClasses}>Description</span>
          <textarea
            className={`${inputClasses} min-h-[110px]`}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What do you do, and when do you meet?"
            disabled={disabled}
            required
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2">
            <span className={labelClasses}>Category</span>
            <select
              className={`${inputClasses} appearance-none`}
              value={category}
              onChange={(event) => setCategory(event.target.value as ClubCategory)}
              disabled={disabled}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-2">
            <span className={labelClasses}>City</span>
            <input
              className={inputClasses}
              value={city}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Where you meet"
              disabled={disabled || isRemote}
              required={!isRemote}
            />
            <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-card-border/70 text-accent focus:ring-accent/40"
                checked={isRemote}
                onChange={(event) => setIsRemote(event.target.checked)}
                disabled={disabled}
              />
              Remote club
            </label>
          </label>
        </div>

        <label className="block space-y-2">
          <span className={labelClasses}>Club image</span>
          <div className="flex flex-col gap-3">
            {imageUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={imageUrl}
                  alt="Club preview"
                  className="h-16 w-16 rounded-2xl object-cover"
                />
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-ink">
                    {imageName ?? "Selected image"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setImageUrl(null);
                      setImageName(null);
                    }}
                    className="text-xs font-semibold text-muted transition hover:text-ink"
                  >
                    Remove image
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between rounded-2xl border border-dashed border-card-border/70 bg-white/90 px-4 py-3 text-xs text-muted">
                <span>Upload a club banner</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={disabled}
                  className="text-xs"
                />
              </div>
            )}
          </div>
        </label>

        {error && (
          <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit || isSaving} requiresAuth={false}>
            {isSaving ? "Creating..." : "Create club"}
          </Button>
        </div>
      </form>
    </Card>
  );
};
