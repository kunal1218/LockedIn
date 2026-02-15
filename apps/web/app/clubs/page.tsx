"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiGet, apiPost } from "@/lib/api";
import {
  ClubCard,
  ClubComposer,
  ClubFilters,
  type Club,
  type ClubComposerPayload,
  type ClubRecencyFilter,
  type ClubCategoryFilter,
  type ClubSortOption,
  type ClubProximityFilter,
} from "@/features/clubs";

const recencyToHours: Record<Exclude<ClubRecencyFilter, "all">, number> = {
  "24h": 24,
  "168h": 168,
};

export default function ClubsPage() {
  const { token, isAuthenticated, openAuthModal, user } = useAuth();
  const router = useRouter();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [recency, setRecency] = useState<ClubRecencyFilter>("all");
  const [category, setCategory] = useState<ClubCategoryFilter>("all");
  const [sortBy, setSortBy] = useState<ClubSortOption>("members");
  const [proximity, setProximity] = useState<ClubProximityFilter>("all");
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const sortedClubs = useMemo(() => {
    const now = Date.now();
    const byRecency =
      recency === "all"
        ? clubs
        : clubs.filter((club) => {
            const createdAt = Date.parse(club.createdAt);
            if (!Number.isFinite(createdAt)) {
              return true;
            }
            return now - createdAt <= recencyToHours[recency] * 60 * 60 * 1000;
          });

    const byCategory =
      category === "all"
        ? byRecency
        : byRecency.filter((club) => club.category === category);

    const byProximity =
      proximity === "all"
        ? byCategory
        : byCategory.filter((club) =>
            proximity === "remote" ? club.isRemote : !club.isRemote
          );

    const compareRecency = (a: Club, b: Club) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    const compareMembers = (a: Club, b: Club) => {
      if (b.memberCount !== a.memberCount) {
        return b.memberCount - a.memberCount;
      }
      return compareRecency(a, b);
    };

    const compareDistance = (a: Club, b: Club) => {
      const distanceA = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const distanceB = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (distanceA !== distanceB) {
        return distanceA - distanceB;
      }
      return compareRecency(a, b);
    };

    const sorter =
      sortBy === "members"
        ? compareMembers
        : sortBy === "distance"
          ? compareDistance
          : compareRecency;

    return [...byProximity].sort(sorter);
  }, [category, clubs, proximity, recency, sortBy]);

  const loadClubs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiGet<{ clubs: Club[] }>(
        "/clubs",
        token ?? undefined
      );
      setClubs(response.clubs ?? []);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Unable to load groups."
      );
      setClubs([]);
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadClubs();
  }, [loadClubs]);

  const handleCreateClub = useCallback(
    async (payload: ClubComposerPayload) => {
      if (!token) {
        openAuthModal("login");
        return;
      }
      setIsPosting(true);
      setError(null);
      try {
        const response = await apiPost<{ club: Club }>(
          "/clubs",
          payload,
          token
        );
        if (response.club) {
          setClubs((prev) => [response.club, ...prev]);
        }
        setComposerOpen(false);
      } catch (postError) {
        setError(
          postError instanceof Error
            ? postError.message
            : "Unable to create group."
        );
      } finally {
        setIsPosting(false);
      }
    },
    [openAuthModal, token]
  );

  const handleOpenClub = useCallback(
    (club: Club) => {
      if (!club.joinedByUser) {
        return;
      }
      router.push(`/clubs/${encodeURIComponent(club.id)}`);
    },
    [router]
  );

  const handleJoin = useCallback(
    async (club: Club) => {
      if (!token) {
        openAuthModal("signup");
        return;
      }
      setError(null);
      if (club.joinPolicy === "application" && club.applicationStatus === "pending") {
        return;
      }
      const isJoined = Boolean(club.joinedByUser);
      setJoiningIds((prev) => new Set(prev).add(club.id));
      try {
        if (isJoined) {
          const response = await apiPost<{ club: Club }>(
            `/clubs/${encodeURIComponent(club.id)}/leave`,
            {},
            token
          );
          if (response.club) {
            setClubs((prev) =>
              prev.map((item) => (item.id === club.id ? response.club : item))
            );
          }
        } else {
          const response = await apiPost<{ club: Club }>(
            `/clubs/${encodeURIComponent(club.id)}/join`,
            {},
            token
          );
          if (response.club) {
            setClubs((prev) =>
              prev.map((item) => (item.id === club.id ? response.club : item))
            );
          }
        }
      } catch (joinError) {
        setError(
          joinError instanceof Error ? joinError.message : "Unable to join group."
        );
      } finally {
        setJoiningIds((prev) => {
          const next = new Set(prev);
          next.delete(club.id);
          return next;
        });
      }
    },
    [openAuthModal, token]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Groups</h1>
            <p className="text-sm text-muted">
              Discover nearby groups and join with a single tap.
            </p>
          </div>
          <Button
            requiresAuth={false}
            onClick={() => {
              if (!isAuthenticated) {
                openAuthModal("signup");
                return;
              }
              setComposerOpen(true);
            }}
          >
            Create a group
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <ClubFilters
            recency={recency}
            onRecencyChange={setRecency}
            category={category}
            onCategoryChange={setCategory}
            proximity={proximity}
            onProximityChange={setProximity}
            sortBy={sortBy}
            onSortChange={setSortBy}
          />
          <div className="space-y-4">
            {error && (
              <Card className="border border-accent/30 bg-accent/10 py-3">
                <p className="text-sm font-semibold text-accent">{error}</p>
              </Card>
            )}
            {isLoading ? (
              <Card className="py-10 text-center text-sm text-muted">
                Loading groups...
              </Card>
            ) : sortedClubs.length === 0 ? (
              <Card className="py-10 text-center text-sm text-muted">
                No groups match those filters yet. Start the first one.
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {sortedClubs.map((club) => (
                  <ClubCard
                    key={club.id}
                    club={club}
                    onJoin={handleJoin}
                    onOpen={handleOpenClub}
                    isClickable={Boolean(club.joinedByUser)}
                    isJoining={joiningIds.has(club.id)}
                    hasJoined={club.joinedByUser}
                    isOwnClub={club.creator.id === user?.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {isComposerOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[90] flex items-center justify-center px-4 py-8">
            <div
              className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
              onClick={() => setComposerOpen(false)}
              aria-hidden="true"
            />
            <div className="relative z-10 w-full max-w-2xl">
              <div className="flex items-center justify-between rounded-t-[24px] border border-card-border/70 bg-white/90 px-4 py-3 md:px-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Groups
                  </p>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Create a group
                  </h2>
                </div>
                <button
                  type="button"
                  className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
                  onClick={() => setComposerOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="rounded-b-[24px] border border-card-border/70 bg-white/95 shadow-[0_32px_80px_rgba(27,26,23,0.18)]">
                <ClubComposer
                  onSubmit={handleCreateClub}
                  isSaving={isPosting}
                  disabled={!isAuthenticated}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
