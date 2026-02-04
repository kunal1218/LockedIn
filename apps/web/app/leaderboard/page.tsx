"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth";
import { apiGet } from "@/lib/api";
import { Card } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";

type LeaderboardEntry = {
  id: string;
  name: string;
  handle: string;
  coins: number;
};

export default function LeaderboardPage() {
  const { token, isAuthenticated, openAuthModal } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setEntries([]);
      setIsLoading(false);
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        const payload = await apiGet<{ entries: LeaderboardEntry[] }>(
          "/leaderboard",
          token
        );
        if (isActive) {
          setEntries(payload.entries ?? []);
        }
        return;
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        if (!message.includes("Route /leaderboard not found")) {
          throw err;
        }
      }

      try {
        const payload = await apiGet<{ entries: LeaderboardEntry[] }>(
          "/ranked/leaderboard",
          token
        );
        if (isActive) {
          setEntries(payload.entries ?? []);
        }
      } catch (err) {
        if (!isActive) return;
        setError(
          err instanceof Error ? err.message : "Unable to load leaderboard."
        );
      }
    };

    load()
      .catch((err) => {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : "Unable to load leaderboard.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [token]);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20">
      <div className="flex flex-col items-start gap-2 pt-6">
        <h1 className="font-display text-2xl font-semibold text-ink">Leaderboard</h1>
        <p className="text-sm text-muted">Top 10 players by total coins.</p>
      </div>

      <Card className="mt-6">
        {!isAuthenticated ? (
          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-muted">
              Log in to see the latest leaderboard.
            </p>
            <Button onClick={() => openAuthModal("login")}>Log in</Button>
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted">Loading leaderboard...</p>
        ) : error ? (
          <p className="text-sm text-rose-500">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted">No coins yet.</p>
        ) : (
          <div className="divide-y divide-card-border/60">
            {entries.map((entry, index) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink/10 text-xs font-semibold text-ink">
                    {index + 1}
                  </div>
                  <Avatar name={entry.name} size={36} />
                  <div>
                    <p className="text-sm font-semibold text-ink">{entry.name}</p>
                    <p className="text-xs text-muted">{entry.handle}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span role="img" aria-label="points">
                    🪙
                  </span>
                  <span>{entry.coins}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </main>
  );
}
