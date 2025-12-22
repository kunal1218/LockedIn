"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";

type MadlibAnswers = {
  when: string;
  focus: string;
  action: string;
};

type ProfileAnswers = {
  career: string;
  madlib: MadlibAnswers;
  memory: string;
};

const emptyAnswers: ProfileAnswers = {
  career: "",
  madlib: {
    when: "",
    focus: "",
    action: "",
  },
  memory: "",
};

const inputBaseClasses =
  "w-full rounded-2xl border border-card-border/80 bg-white/80 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";
const stackedInputClasses = `mt-2 ${inputBaseClasses}`;

const labelClasses = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";

const storageKey = (userId: string) => `lockedin_profile_answers:${userId}`;

const sanitizeAnswers = (value: ProfileAnswers): ProfileAnswers => ({
  career: value.career.trim(),
  madlib: {
    when: value.madlib.when.trim(),
    focus: value.madlib.focus.trim(),
    action: value.madlib.action.trim(),
  },
  memory: value.memory.trim(),
});

const readStoredAnswers = (userId: string): ProfileAnswers | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileAnswers>;
    return {
      career: parsed.career ?? "",
      madlib: {
        when: parsed.madlib?.when ?? "",
        focus: parsed.madlib?.focus ?? "",
        action: parsed.madlib?.action ?? "",
      },
      memory: parsed.memory ?? "",
    };
  } catch {
    return null;
  }
};

const writeStoredAnswers = (userId: string, answers: ProfileAnswers) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(userId), JSON.stringify(answers));
};

const hasCompleteAnswers = (answers: ProfileAnswers | null) => {
  if (!answers) {
    return false;
  }

  return Boolean(
    answers.career &&
      answers.memory &&
      answers.madlib.when &&
      answers.madlib.focus &&
      answers.madlib.action
  );
};

const buildMadlibAnswer = (answers: ProfileAnswers | null) => {
  if (!answers) {
    return "";
  }

  const { when, focus, action } = answers.madlib;
  if (!when || !focus || !action) {
    return "";
  }

  return `Whenever I'm ${when}, my ${focus} stop and ${action}.`;
};

export const ProfileDetails = () => {
  const { user, isAuthenticated } = useAuth();
  const [answers, setAnswers] = useState<ProfileAnswers | null>(null);
  const [formState, setFormState] = useState<ProfileAnswers>(emptyAnswers);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setAnswers(null);
      setFormState(emptyAnswers);
      setIsLoaded(true);
      return;
    }

    const stored = readStoredAnswers(user.id);
    setAnswers(stored);
    setFormState(stored ?? emptyAnswers);
    setIsLoaded(true);
  }, [user?.id]);

  const needsQuestionnaire =
    Boolean(user?.id) && isAuthenticated && isLoaded && !hasCompleteAnswers(answers);

  useEffect(() => {
    if (!needsQuestionnaire) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [needsQuestionnaire]);

  const cards = useMemo(
    () => [
      {
        id: "career",
        title: "If you guaranteed success, what career would you chose?",
        answer: answers?.career,
      },
      {
        id: "madlib",
        title: "Whenever I'm ____, my ____ stop and ____.",
        answer: buildMadlibAnswer(answers),
      },
      {
        id: "memory",
        title: "What's your favorite memory?",
        answer: answers?.memory,
      },
    ],
    [answers]
  );

  const placeholder = "Answer this to personalize your profile.";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user?.id) {
      return;
    }

    const sanitized = sanitizeAnswers(formState);
    setAnswers(sanitized);
    writeStoredAnswers(user.id, sanitized);
  };

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Card key={card.id}>
            <h3 className="font-display text-lg font-semibold">{card.title}</h3>
            <p className="mt-2 text-sm text-muted">
              {card.answer?.trim() ? card.answer : placeholder}
            </p>
          </Card>
        ))}
      </div>

      {needsQuestionnaire && (
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
                  Answer three quick questions
                </h2>
                <p className="mt-2 text-sm text-muted">
                  Quick answers only. We’ll turn them into your headline cards.
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

                <Button
                  type="submit"
                  requiresAuth={false}
                  className="w-full"
                >
                  Save my answers
                </Button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
