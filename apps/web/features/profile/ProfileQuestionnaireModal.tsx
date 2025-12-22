"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import {
  getEmptyProfileAnswers,
  useProfileAnswers,
} from "./ProfileAnswersContext";

const inputBaseClasses =
  "w-full rounded-2xl border border-card-border/80 bg-white/80 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";
const stackedInputClasses = `mt-2 ${inputBaseClasses}`;

const labelClasses = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";

type ProfileQuestionnaireModalProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export const ProfileQuestionnaireModal = ({
  isOpen = false,
  onClose,
}: ProfileQuestionnaireModalProps) => {
  const { answers, needsQuestionnaire, saveAnswers } = useProfileAnswers();
  const [formState, setFormState] = useState(getEmptyProfileAnswers());
  const isVisible = needsQuestionnaire || isOpen;
  const isEditing = Boolean(isOpen) && !needsQuestionnaire;

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    setFormState(answers ?? getEmptyProfileAnswers());
  }, [answers, isVisible]);

  if (!isVisible) {
    return null;
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveAnswers(formState);
    if (!needsQuestionnaire) {
      onClose?.();
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-8">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[28px] border border-card-border/70 bg-white/95 shadow-[0_32px_80px_rgba(27,26,23,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-questions-title"
      >
        <div className="grid gap-6 p-6 md:p-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted">
              Profile Pulse
            </p>
            <h2
              id="profile-questions-title"
              className="mt-3 font-display text-2xl font-semibold text-ink"
            >
              {isEditing ? "Update your answers" : "Answer three quick questions"}
            </h2>
            <p className="mt-2 text-sm text-muted">
              {isEditing
                ? "Tweak your responses and we’ll refresh your headline cards."
                : "Quick answers only. We’ll turn them into your headline cards."}
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className={labelClasses}>Question 1</span>
              <p className="mt-2 text-sm font-semibold text-ink">
                If you guaranteed success, what career would you chose?
              </p>
              <input
                className={stackedInputClasses}
                value={formState.career}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    career: event.target.value,
                  }))
                }
                placeholder="Space therapist, pro gamer, cinematic chef..."
                required
              />
            </label>

            <div className="rounded-[20px] border border-card-border/70 bg-white/80 p-4">
              <span className={labelClasses}>Question 2</span>
              <p className="mt-2 text-sm font-semibold text-ink">
                Fill in the blanks.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>Whenever I'm</span>
                <input
                  className={`${inputBaseClasses} w-32`}
                  value={formState.madlib.when}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      madlib: { ...prev.madlib, when: event.target.value },
                    }))
                  }
                  placeholder="coding at 2am"
                  required
                />
                <span>, my</span>
                <input
                  className={`${inputBaseClasses} w-32`}
                  value={formState.madlib.focus}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      madlib: { ...prev.madlib, focus: event.target.value },
                    }))
                  }
                  placeholder="notifications"
                  required
                />
                <span>stop and</span>
                <input
                  className={`${inputBaseClasses} w-32`}
                  value={formState.madlib.action}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      madlib: { ...prev.madlib, action: event.target.value },
                    }))
                  }
                  placeholder="vanish"
                  required
                />
                <span>.</span>
              </div>
            </div>

            <label className="block">
              <span className={labelClasses}>Question 3</span>
              <p className="mt-2 text-sm font-semibold text-ink">
                What's your favorite memory?
              </p>
              <textarea
                className={`${stackedInputClasses} min-h-[120px]`}
                value={formState.memory}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    memory: event.target.value,
                  }))
                }
                placeholder="The time my friends and I built a pancake stand..."
                required
              />
            </label>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
              {isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  requiresAuth={false}
                  onClick={onClose}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                requiresAuth={false}
                className="w-full sm:w-auto"
              >
                {isEditing ? "Save changes" : "Save my answers"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
