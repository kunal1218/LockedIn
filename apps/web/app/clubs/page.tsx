"use client";

import { createPortal } from "react-dom";
import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import {
  ClubCard,
  ClubComposer,
  ClubFilters,
  mockClubs,
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

const buildClubId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `club-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export default function ClubsPage() {
  const { token, isAuthenticated, openAuthModal, user } = useAuth();
  const [clubs, setClubs] = useState<Club[]>(mockClubs);
  const [recency, setRecency] = useState<ClubRecencyFilter>("24h");
  const [category, setCategory] = useState<ClubCategoryFilter>("all");
  const [sortBy, setSortBy] = useState<ClubSortOption>("distance");
  const [proximity, setProximity] = useState<ClubProximityFilter>("nearby");
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [joiningIds, setJoiningIds] = useState<Set<string>>(new Set());
  const [joinedIds, setJoinedIds] = useState<Set<string>>(
    new Set(mockClubs.filter((club) => club.joinedByUser).map((club) => club.id))
  );
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
        : byCategory.filter((club) => {
            if (proximity === "remote") {
              return club.isRemote;
            }
            const distance = club.distanceKm ?? Number.POSITIVE_INFINITY;
            return !club.isRemote && distance <= 10;
          });

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

  const handleCreateClub = useCallback(
    async (payload: ClubComposerPayload) => {
      if (!token) {
        openAuthModal("login");
        return;
      }
      setIsPosting(true);
      setError(null);
      try {
        const newClub: Club = {
          id: buildClubId(),
          title: payload.title,
          description: payload.description,
          category: payload.category,
          city: payload.city,
          location: payload.isRemote ? "Remote" : payload.city ?? "Campus",
          isRemote: payload.isRemote,
          distanceKm: payload.isRemote
            ? null
            : Math.max(0.5, Math.round((Math.random() * 6 + 0.5) * 10) / 10),
          memberCount: 1,
          createdAt: new Date().toISOString(),
          imageUrl: payload.imageUrl ?? null,
          creator: {
            id: user?.id ?? "you",
            name: user?.name ?? "You",
            handle: user?.handle ?? "@you",
          },
          joinedByUser: true,
        };
        setClubs((prev) => [newClub, ...prev]);
        setJoinedIds((prev) => new Set(prev).add(newClub.id));
        setComposerOpen(false);
      } catch (postError) {
        setError(
          postError instanceof Error
            ? postError.message
            : "Unable to create club."
        );
      } finally {
        setIsPosting(false);
      }
    },
    [openAuthModal, token, user?.handle, user?.id, user?.name]
  );

  const handleJoin = useCallback(
    async (club: Club) => {
      if (!token) {
        openAuthModal("signup");
        return;
      }
      setError(null);
      const isJoined = joinedIds.has(club.id);
      setJoiningIds((prev) => new Set(prev).add(club.id));
      try {
        if (isJoined) {
          setJoinedIds((prev) => {
            const next = new Set(prev);
            next.delete(club.id);
            return next;
          });
          setClubs((prev) =>
            prev.map((item) =>
              item.id === club.id
                ? {
                    ...item,
                    joinedByUser: false,
                    memberCount: Math.max(0, item.memberCount - 1),
                  }
                : item
            )
          );
        } else {
          setJoinedIds((prev) => new Set(prev).add(club.id));
          setClubs((prev) =>
            prev.map((item) =>
              item.id === club.id
                ? {
                    ...item,
                    joinedByUser: true,
                    memberCount: item.memberCount + 1,
                  }
                : item
            )
          );
        }
      } catch (joinError) {
        setError(
          joinError instanceof Error ? joinError.message : "Unable to join club."
        );
      } finally {
        setJoiningIds((prev) => {
          const next = new Set(prev);
          next.delete(club.id);
          return next;
        });
      }
    },
    [joinedIds, openAuthModal, token]
  );

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Clubs</h1>
            <p className="text-sm text-muted">
              Discover nearby clubs and join with a single tap.
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
            Create a club
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
            {sortedClubs.length === 0 ? (
              <Card className="py-10 text-center text-sm text-muted">
                No clubs match those filters yet. Start the first one.
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {sortedClubs.map((club) => (
                  <ClubCard
                    key={club.id}
                    club={club}
                    onJoin={handleJoin}
                    isJoining={joiningIds.has(club.id)}
                    hasJoined={joinedIds.has(club.id)}
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
                    Clubs
                  </p>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Create a club
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
