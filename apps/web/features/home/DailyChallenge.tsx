"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
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

export const DailyChallenge = () => {
  const endsAt = dailyChallenge.endsAt;
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(endsAt));

  useEffect(() => {
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

  return (
    <Card className="relative overflow-hidden border-accent/20 bg-gradient-to-br from-white via-white to-accent-4/70">
      <div className="absolute -right-20 top-8 h-44 w-44 rounded-full bg-accent/15 blur-2xl" />
      <div className="absolute -left-16 bottom-6 h-32 w-32 rounded-full bg-accent-2/20 blur-2xl" />
      <div className="relative grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div>
          <Tag tone="accent">Daily Challenge</Tag>
          <h1 className="mt-4 font-display text-3xl font-semibold text-ink">
            {dailyChallenge.title}
          </h1>
          <p className="mt-3 text-base text-muted">{dailyChallenge.description}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button>Join the chaos</Button>
            <Button variant="outline">Post your attempt</Button>
          </div>
          <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            {dailyChallenge.participants} people are in today
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
    </Card>
  );
};
