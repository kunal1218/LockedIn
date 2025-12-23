"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import type { DailyChallenge as DailyChallengeType } from "@lockedin/shared";
import { createPortal } from "react-dom";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import { apiGet, apiPost } from "@/lib/api";
import { dailyChallenge } from "./mock";

const getTimeLeft = (endsAt: string) => {
  const diff = new Date(endsAt).getTime() - Date.now();
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
    expired: totalSeconds <= 0,
  };
};

const formatNumber = (value: number) => value.toString().padStart(2, "0");

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

type ChallengeAttemptModalProps = {
  isOpen: boolean;
  challengeTitle: string;
  token: string | null;
  onClose: () => void;
};

const ChallengeAttemptModal = ({
  isOpen,
  challengeTitle,
  token,
  onClose,
}: ChallengeAttemptModalProps) => {
  const [imageData, setImageData] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setImageData(null);
    setPreviewUrl(null);
    setError(null);
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file.");
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image is too large. Please upload something under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setImageData(result || null);
      setPreviewUrl(result || null);
      setError(null);
    };
    reader.onerror = () => {
      setError("Unable to read that file. Please try another image.");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError("Please log in before submitting.");
      return;
    }

    if (!imageData) {
      setError("Please add a photo before submitting.");
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPost("/challenge/attempts", { imageData }, token);
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to submit your attempt."
      );
    } finally {
      setIsSubmitting(false);
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
        aria-labelledby="challenge-attempt-title"
      >
        <form className="grid gap-6 p-6 md:p-8" onSubmit={handleSubmit}>
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted">
                Daily Challenge
              </p>
              <h2
                id="challenge-attempt-title"
                className="mt-3 font-display text-2xl font-semibold text-ink"
              >
                Post your attempt
              </h2>
              <p className="mt-2 text-sm text-muted">
                Share proof for “{challengeTitle}” so the admins can review it.
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

          <div className="rounded-2xl border border-dashed border-card-border/80 bg-white/80 p-5">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Upload proof
            </label>
            <input
              type="file"
              accept="image/*"
              className="mt-3 block w-full text-sm text-muted file:mr-4 file:rounded-full file:border-0 file:bg-accent/15 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-accent"
              onChange={handleFileChange}
            />
            <p className="mt-2 text-xs text-muted">
              JPG or PNG, up to 2MB.
            </p>
            {previewUrl && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-card-border/70 bg-white">
                <img
                  src={previewUrl}
                  alt="Attempt preview"
                  className="h-auto w-full object-cover"
                />
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs font-semibold text-accent">{error}</p>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            <Button variant="outline" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit attempt"}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export const DailyChallenge = () => {
  const { isAuthenticated, openAuthModal, token } = useAuth();
  const [challenge, setChallenge] = useState<DailyChallengeType | null>(null);
  const [isAttemptOpen, setAttemptOpen] = useState(false);
  const endsAt = (challenge ?? dailyChallenge).endsAt;
  const [timeLeft, setTimeLeft] = useState(() => ({
    hours: 0,
    minutes: 0,
    seconds: 0,
    expired: false,
  }));

  useEffect(() => {
    let isActive = true;

    apiGet<DailyChallengeType>("/challenge/today")
      .then((payload) => {
        if (!isActive) {
          return;
        }
        setChallenge(payload);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }
        setChallenge(null);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setTimeLeft(getTimeLeft(endsAt));
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(endsAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [endsAt]);

  const timerLabel = useMemo(() => {
    if (timeLeft.expired) return "Time's up";
    return `${formatNumber(timeLeft.hours)}:${formatNumber(
      timeLeft.minutes
    )}:${formatNumber(timeLeft.seconds)}`;
  }, [timeLeft]);

  const activeChallenge = challenge ?? dailyChallenge;

  const handleOpenAttempt = () => {
    if (!isAuthenticated) {
      openAuthModal("signup");
      return;
    }
    setAttemptOpen(true);
  };

  return (
    <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-white via-white to-accent-4/70">
      <div className="absolute -right-20 top-8 h-44 w-44 rounded-full bg-accent/15 blur-2xl" />
      <div className="absolute -left-16 bottom-6 h-32 w-32 rounded-full bg-accent-2/20 blur-2xl" />
      <div className="relative grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <Tag tone="accent">Daily Challenge</Tag>
          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
            {activeChallenge.title}
          </h1>
          <p className="mt-3 text-base text-muted">
            {activeChallenge.description}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button>Join the chaos</Button>
            <Button variant="outline" onClick={handleOpenAttempt}>
              Post your attempt
            </Button>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {activeChallenge.participants} people are in today
          </p>
        </div>
        <div className="flex flex-col justify-between rounded-[20px] border border-accent/20 bg-white/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            Countdown
          </p>
          <div className="mt-6 flex items-baseline gap-4">
            <span className="font-display text-4xl font-semibold text-ink">
              {timerLabel}
            </span>
            <span className="text-sm text-muted">left today</span>
          </div>
          <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs font-semibold text-muted">
            <div className="rounded-xl bg-accent/10 px-2 py-3">
              {formatNumber(timeLeft.hours)}
              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em]">
                hrs
              </span>
            </div>
            <div className="rounded-xl bg-accent-2/10 px-2 py-3">
              {formatNumber(timeLeft.minutes)}
              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em]">
                min
              </span>
            </div>
            <div className="rounded-xl bg-accent-3/20 px-2 py-3">
              {formatNumber(timeLeft.seconds)}
              <span className="mt-1 block text-[10px] uppercase tracking-[0.2em]">
                sec
              </span>
            </div>
          </div>
        </div>
      </div>
      <ChallengeAttemptModal
        isOpen={isAttemptOpen}
        challengeTitle={activeChallenge.title}
        token={token}
        onClose={() => setAttemptOpen(false)}
      />
    </Card>
  );
};
