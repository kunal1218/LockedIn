"use client";

import { useEffect, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import type { FeedPost } from "@lockedin/shared";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";

const labelClasses = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";
const inputBaseClasses =
  "w-full rounded-2xl border border-card-border/80 bg-white/80 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

const MAX_TAGS = 10;
const MAX_POLL_OPTIONS = 4;

const normalizeTag = (value: string) =>
  value.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase();

type ComposerMode = "text" | "poll";

export type PostComposerMode = "create" | "edit";

export type PostComposerPayload = {
  type: "text" | "poll";
  content: string;
  tags: string[];
  pollOptions?: string[];
};

type PostComposerModalProps = {
  isOpen: boolean;
  mode?: PostComposerMode;
  initialPost?: FeedPost | null;
  onClose: () => void;
  onSubmit: (payload: PostComposerPayload) => Promise<void> | void;
};

export const PostComposerModal = ({
  isOpen,
  mode = "create",
  initialPost,
  onClose,
  onSubmit,
}: PostComposerModalProps) => {
  const [postType, setPostType] = useState<ComposerMode>("text");
  const [message, setMessage] = useState("");
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const isPoll = initialPost?.type === "poll";
    const startingType = isPoll ? "poll" : "text";
    setPostType(startingType);
    setMessage(
      initialPost && initialPost.type !== "poll" ? initialPost.content : ""
    );
    setPollQuestion(initialPost && isPoll ? initialPost.content : "");
    setPollOptions(
      initialPost?.pollOptions?.map((option) => option.label) ?? ["", ""]
    );
    setTags(initialPost?.tags ?? []);
    setTagInput("");
    setSubmitError(null);
  }, [initialPost, isOpen]);

  if (!isOpen) {
    return null;
  }

  if (typeof document === "undefined") {
    return null;
  }

  const trimmedMessage = message.trim();
  const trimmedQuestion = pollQuestion.trim();
  const cleanedOptions = pollOptions
    .map((option) => option.trim())
    .filter(Boolean);
  const canSubmit =
    postType === "text"
      ? trimmedMessage.length > 0
      : trimmedQuestion.length > 0 && cleanedOptions.length >= 2;

  const handleAddTag = (value: string) => {
    if (!value) {
      return;
    }

    if (tags.length >= MAX_TAGS) {
      setTagInput("");
      return;
    }

    const normalized = normalizeTag(value);
    if (!normalized || tags.includes(normalized)) {
      setTagInput("");
      return;
    }

    setTags((prev) => [...prev, normalized]);
    setTagInput("");
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    handleAddTag(tagInput);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError(null);

    if (!canSubmit) {
      setSubmitError(
        postType === "text"
          ? "Please add a message before posting."
          : "Polls need a question and at least two options."
      );
      return;
    }

    setIsSaving(true);

    try {
      await onSubmit({
        type: postType,
        content: postType === "poll" ? trimmedQuestion : trimmedMessage,
        tags,
        pollOptions: postType === "poll" ? cleanedOptions : undefined,
      });
      onClose();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to save your post."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 py-8">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[28px] border border-card-border/70 bg-white/95 shadow-[0_32px_80px_rgba(27,26,23,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="compose-post-title"
      >
        <div className="grid gap-6 p-6 md:p-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted">
                Global Feed
              </p>
              <h2
                id="compose-post-title"
                className="mt-3 font-display text-2xl font-semibold text-ink"
              >
                {mode === "edit" ? "Edit your post" : "Create a post"}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {mode === "edit"
                  ? "Tweak your message or poll to keep the energy right."
                  : "Share a quick update or spin up a poll with your campus crew."}
              </p>
            </div>
            <button
              type="button"
              className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
              onClick={onClose}
            >
              Close
            </button>
          </div>

          {mode === "create" ? (
            <div className="flex flex-wrap gap-2">
              {(["text", "poll"] as const).map((modeOption) => {
                const isActive = postType === modeOption;
                return (
                  <button
                    key={modeOption}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      setPostType(modeOption);
                      setSubmitError(null);
                    }}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                      isActive
                        ? "bg-accent text-white shadow-[0_12px_24px_rgba(255,134,88,0.25)]"
                        : "border border-card-border/70 bg-white/80 text-ink hover:border-accent/60"
                    }`}
                  >
                    {modeOption === "text" ? "Message" : "Poll"}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              {postType === "poll" ? "Poll" : "Message"}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            {postType === "text" ? (
              <label className="block">
                <span className={labelClasses}>Your message</span>
                <textarea
                  className={`mt-2 min-h-[120px] ${inputBaseClasses}`}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Drop a quick update, invite collaborators, or share a vibe."
                  required
                />
              </label>
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className={labelClasses}>Poll question</span>
                  <input
                    className={`mt-2 ${inputBaseClasses}`}
                    value={pollQuestion}
                    onChange={(event) => setPollQuestion(event.target.value)}
                    placeholder="Ask something fun or useful."
                    required
                  />
                </label>
                <div>
                  <span className={labelClasses}>Options</span>
                  <div className="mt-3 space-y-3">
                    {pollOptions.map((option, index) => (
                      <div
                        key={`option-${index}`}
                        className="flex items-center gap-2"
                      >
                        <input
                          className={inputBaseClasses}
                          value={option}
                          onChange={(event) =>
                            setPollOptions((prev) =>
                              prev.map((current, optionIndex) =>
                                optionIndex === index
                                  ? event.target.value
                                  : current
                              )
                            )
                          }
                          placeholder={`Option ${index + 1}`}
                          required={index < 2}
                        />
                        {pollOptions.length > 2 && (
                          <button
                            type="button"
                            className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                            onClick={() =>
                              setPollOptions((prev) =>
                                prev.filter(
                                  (_option, optionIndex) => optionIndex !== index
                                )
                              )
                            }
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      requiresAuth={false}
                      onClick={() =>
                        setPollOptions((prev) =>
                          prev.length >= MAX_POLL_OPTIONS
                            ? prev
                            : [...prev, ""]
                        )
                      }
                      disabled={pollOptions.length >= MAX_POLL_OPTIONS}
                    >
                      Add option
                    </Button>
                    <span className="text-xs text-muted">
                      Up to {MAX_POLL_OPTIONS} options.
                    </span>
                  </div>
                  {cleanedOptions.length < 2 && (
                    <p className="mt-2 text-xs text-muted">
                      Add at least two options to launch a poll.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between">
                <span className={labelClasses}>Tags</span>
                <span className="text-xs font-semibold text-muted">
                  {tags.length}/{MAX_TAGS}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted">
                Add up to 10 tags so people can find your post.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {tags.length === 0 && (
                  <span className="text-xs text-muted">No tags yet.</span>
                )}
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-2 rounded-full border border-card-border/70 bg-white/80 px-3 py-1 text-xs font-semibold text-ink"
                  >
                    {tag}
                    <button
                      type="button"
                      className="text-muted transition hover:text-ink"
                      onClick={() =>
                        setTags((prev) => prev.filter((value) => value !== tag))
                      }
                      aria-label={`Remove ${tag}`}
                    >
                      x
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-3">
                <input
                  className={inputBaseClasses}
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  onKeyDown={handleTagKeyDown}
                  placeholder="Type a tag and press Enter"
                  disabled={tags.length >= MAX_TAGS}
                />
              </div>
            </div>

            {submitError && (
              <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                {submitError}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                requiresAuth={false}
                onClick={onClose}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                requiresAuth={false}
                disabled={!canSubmit || isSaving}
              >
                {isSaving
                  ? "Saving..."
                  : mode === "edit"
                  ? "Save changes"
                  : "Post"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
};
