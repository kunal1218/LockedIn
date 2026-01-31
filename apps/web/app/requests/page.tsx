"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { RequestCard as RequestCardType } from "@lockedin/shared";
import {
  RequestCard,
  RequestComposer,
  RequestFilters,
  type RecencyFilter,
  type UrgencyFilter,
  type SortOption,
  type ProximityFilter,
  type RequestComposerPayload,
} from "@/features/requests";
import { Card } from "@/components/Card";
import { Button } from "@/components/Button";
import { useAuth } from "@/features/auth";
import { apiDelete, apiGet, apiPost } from "@/lib/api";

const recencyToHours: Record<Exclude<RecencyFilter, "all">, number> = {
  "1h": 1,
  "24h": 24,
  "168h": 168,
};

export default function RequestsPage() {
  const { token, isAuthenticated, openAuthModal, user } = useAuth();
  const [requests, setRequests] = useState<RequestCardType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recency, setRecency] = useState<RecencyFilter>("all");
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("recency");
  const [proximity, setProximity] = useState<ProximityFilter>("all");
  const [isPosting, setIsPosting] = useState(false);
  const [helpingIds, setHelpingIds] = useState<Set<string>>(new Set());
  const [helpedIds, setHelpedIds] = useState<Set<string>>(new Set());
  const [likingIds, setLikingIds] = useState<Set<string>>(new Set());
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [autoPruneActive, setAutoPruneActive] = useState(false);
  const hasActiveRequest = useMemo(
    () => Boolean(user?.id && requests.some((request) => request.creator.id === user.id)),
    [requests, user?.id]
  );

  const sortedRequests = useMemo(() => {
    const filteredByUrgency =
      urgencyFilter === "all"
        ? requests
        : requests.filter((req) => (req.urgency ?? "low") === urgencyFilter);

    const filtered =
      proximity === "all"
        ? filteredByUrgency
        : filteredByUrgency.filter((req) =>
            proximity === "remote" ? req.isRemote : !req.isRemote
          );

    const byRecency = (a: RequestCardType, b: RequestCardType) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    const byLikes = (a: RequestCardType, b: RequestCardType) => {
      if (b.likeCount !== a.likeCount) {
        return b.likeCount - a.likeCount;
      }
      return byRecency(a, b);
    };

    const urgencyRank = (value?: string | null) => {
      const u = (value ?? "low").toLowerCase();
      if (u === "high") return 3;
      if (u === "medium") return 2;
      return 1;
    };

    const byUrgency = (a: RequestCardType, b: RequestCardType) => {
      const diff = urgencyRank(b.urgency) - urgencyRank(a.urgency);
      if (diff !== 0) return diff;
      return byRecency(a, b);
    };

    const sorter =
      sortBy === "likes" ? byLikes : sortBy === "urgency" ? byUrgency : byRecency;

    return [...filtered].sort(sorter);
  }, [requests, urgencyFilter, sortBy]);

  const loadRequests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("order", "newest");
    if (recency !== "all") {
      params.set("sinceHours", recencyToHours[recency].toString());
    }
    try {
      const response = await apiGet<
        | { requests: RequestCardType[]; meta?: { autoPruneActive?: boolean } }
        | RequestCardType[]
      >(
        `/requests?${params.toString()}`,
        token ?? undefined
      );
      const next = Array.isArray(response) ? response : response?.requests ?? [];
      setRequests(next);
      setHelpedIds(new Set(next.filter((item) => item.helpedByUser).map((item) => item.id)));
      setAutoPruneActive(
        !Array.isArray(response) && Boolean(response?.meta?.autoPruneActive)
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load requests."
      );
      setAutoPruneActive(false);
    } finally {
      setIsLoading(false);
    }
  }, [recency, token]);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const handleCreateRequest = async (payload: RequestComposerPayload) => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    setIsPosting(true);
    setError(null);
    try {
      const requestBody = {
        ...payload,
        location: payload.isRemote
          ? "Remote"
          : payload.city && payload.city.trim()
            ? payload.city.trim()
            : "Unknown",
      };
      const response = await apiPost<{ request: RequestCardType }>(
        "/requests",
        requestBody,
        token
      );
      setRequests((prev) => [response.request, ...prev]);
      setComposerOpen(false);
    } catch (postError) {
      setError(
        postError instanceof Error
          ? postError.message
          : "Unable to post your request."
      );
    } finally {
      setIsPosting(false);
    }
  };

  const handleHelp = async (request: RequestCardType) => {
    if (!token) {
      openAuthModal("signup");
      return;
    }
    setError(null);
    const isAlreadyHelped = helpedIds.has(request.id);
    setHelpingIds((prev) => new Set(prev).add(request.id));
    try {
      if (isAlreadyHelped) {
        await apiDelete(`/requests/${encodeURIComponent(request.id)}/help`, token);
        setHelpedIds((prev) => {
          const next = new Set(prev);
          next.delete(request.id);
          return next;
        });
        setRequests((prev) =>
          prev.map((item) =>
            item.id === request.id ? { ...item, helpedByUser: false } : item
          )
        );
      } else {
        await apiPost(`/requests/${encodeURIComponent(request.id)}/help`, {}, token);
        setHelpedIds((prev) => new Set(prev).add(request.id));
        setRequests((prev) =>
          prev.map((item) =>
            item.id === request.id ? { ...item, helpedByUser: true } : item
          )
        );
      }
    } catch (helpError) {
      setError(
        helpError instanceof Error
          ? helpError.message
          : "Unable to send help offer."
      );
    } finally {
      setHelpingIds((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  };

  const handleLike = async (request: RequestCardType) => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    setError(null);
    setLikingIds((prev) => new Set(prev).add(request.id));
    try {
      const response = await apiPost<{ likeCount: number; liked: boolean }>(
        `/requests/${encodeURIComponent(request.id)}/like`,
        {},
        token
      );
      setRequests((prev) =>
        prev.map((item) =>
          item.id === request.id
            ? { ...item, likeCount: response.likeCount, likedByUser: response.liked }
            : item
        )
      );
    } catch (likeError) {
      setError(
        likeError instanceof Error
          ? likeError.message
          : "Unable to update likes."
      );
    } finally {
      setLikingIds((prev) => {
        const next = new Set(prev);
        next.delete(request.id);
        return next;
      });
    }
  };

  const handleDelete = async (request: RequestCardType) => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    const confirmed = window.confirm("Delete this request? This cannot be undone.");
    if (!confirmed) return;
    setError(null);
    try {
      await apiDelete(`/requests/${encodeURIComponent(request.id)}`, token);
      setRequests((prev) => prev.filter((item) => item.id !== request.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete request."
      );
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-semibold">Requests</h1>
            <p className="text-sm text-muted">
              Ask for help, offer help, or start a spontaneous mission.
            </p>
          </div>
          <Button
            requiresAuth={false}
            onClick={() => {
              if (!isAuthenticated) {
                openAuthModal("signup");
                return;
              }
              if (hasActiveRequest) {
                setError("You already have an active request. Delete it to post another.");
                return;
              }
              setComposerOpen(true);
            }}
          >
            Post a request
          </Button>
        </div>

        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <RequestFilters
            recency={recency}
            onRecencyChange={setRecency}
            urgency={urgencyFilter}
            onUrgencyChange={setUrgencyFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            proximity={proximity}
            onProximityChange={setProximity}
          />
          <div className="space-y-4">
            {error && (
              <Card className="border border-accent/30 bg-accent/10 py-3">
                <p className="text-sm font-semibold text-accent">{error}</p>
              </Card>
            )}
            {autoPruneActive && (
              <Card className="border border-amber-200/70 bg-amber-50/70 py-3">
                <p className="text-sm font-semibold text-amber-700">
                  High volume: requests older than two weeks may be automatically removed.
                </p>
              </Card>
            )}
            {sortedRequests.length === 0 ? (
              <Card className="py-10 text-center text-sm text-muted">
                No requests right now. Start the first one.
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {sortedRequests.map((request) => (
                  <RequestCard
                    key={request.id}
                    request={request}
                    onHelp={handleHelp}
                    isHelping={helpingIds.has(request.id)}
                    hasHelped={helpedIds.has(request.id)}
                    isOwnRequest={request.creator.id === user?.id}
                    onLike={handleLike}
                    isLiking={likingIds.has(request.id)}
                    onDelete={handleDelete}
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
                    Requests
                  </p>
                  <h2 className="font-display text-xl font-semibold text-ink">
                    Post a request
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
                <RequestComposer
                  onSubmit={handleCreateRequest}
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
