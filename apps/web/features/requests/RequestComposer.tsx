import { useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";

export type RequestComposerPayload = {
  title: string;
  description: string;
  tags: string[];
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

const MAX_TAGS = 8;

export const RequestComposer = ({
  onSubmit,
  isSaving = false,
  disabled = false,
}: RequestComposerProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [urgency, setUrgency] = useState<RequestComposerPayload["urgency"]>("low");
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    !isSaving &&
    !disabled;

  const addTag = (raw: string) => {
    if (tags.length >= MAX_TAGS) {
      setTagInput("");
      return;
    }
    const cleaned = raw
      .trim()
      .replace(/^#/, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    if (!cleaned || tags.includes(cleaned)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, cleaned]);
    setTagInput("");
  };

  const removeTag = (target: string) => {
    setTags((prev) => prev.filter((tag) => tag !== target));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    if (!canSubmit) {
      setError("Add a title, description, and location.");
      return;
    }

    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        tags,
        urgency,
      });
      setTitle("");
      setDescription("");
      setTags([]);
      setTagInput("");
      setUrgency("low");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to post request.");
    }
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={labelClasses}>Tags</span>
            <span className="text-xs font-semibold text-muted">
              {tags.length}/{MAX_TAGS}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-2 rounded-full border border-card-border/70 bg-white/80 px-3 py-1 text-xs font-semibold text-ink"
              >
                {tag}
                <button
                  type="button"
                  className="text-muted transition hover:text-ink"
                  onClick={() => removeTag(tag)}
                  aria-label={`Remove ${tag}`}
                  disabled={disabled}
                >
                  ×
                </button>
              </span>
            ))}
            {tags.length === 0 && (
              <span className="text-xs text-muted">No tags yet.</span>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className={inputClasses}
              value={tagInput}
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addTag(tagInput);
                }
              }}
              placeholder="Add a tag and press enter"
              disabled={disabled || tags.length >= MAX_TAGS}
            />
            <Button
              type="button"
              variant="outline"
              requiresAuth={false}
              onClick={() => addTag(tagInput)}
              disabled={
                disabled || !tagInput.trim() || tags.length >= MAX_TAGS || isSaving
              }
              className="w-full sm:w-auto"
            >
              Add tag
            </Button>
          </div>
        </div>

        {error && (
          <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={!canSubmit} requiresAuth={false}>
            {isSaving ? "Posting..." : "Post request"}
          </Button>
        </div>
      </form>
    </Card>
  );
};
