"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { deriveCollegeFromDomain } from "@/lib/college";
import { ProfileQuestionCard } from "./ProfileQuestionCard";

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

type PublicProfilePayload = {
  user: {
    id: string;
    name: string;
    handle: string;
    collegeName?: string | null;
    collegeDomain?: string | null;
  };
  answers: ProfileAnswers | null;
};

type RelationshipStatus =
  | "none"
  | "incoming"
  | "outgoing"
  | "friends"
  | "blocked"
  | "blocked_by";

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

export const PublicProfileView = ({ handle }: { handle: string }) => {
  const { user: viewer, token, isAuthenticated, openAuthModal } = useAuth();
  const [profile, setProfile] = useState<PublicProfilePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [relationship, setRelationship] = useState<RelationshipStatus>("none");
  const [isRelationshipLoading, setRelationshipLoading] = useState(false);
  const [relationshipError, setRelationshipError] = useState<string | null>(null);

  const fallbackHandle = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    const marker = "/profile/";
    const path = window.location.pathname;
    const index = path.indexOf(marker);
    if (index === -1) {
      return "";
    }

    const segment = path.slice(index + marker.length).split("/")[0] ?? "";
    if (!segment) {
      return "";
    }

    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  }, []);

  const rawHandle = typeof handle === "string" ? handle : "";
  const sanitizedHandle = (rawHandle || fallbackHandle)
    .trim()
    .replace(/^@/, "")
    .trim();

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      if (!sanitizedHandle) {
        setError("Profile handle is missing.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await apiGet<PublicProfilePayload>(
          `/profile/public/${encodeURIComponent(sanitizedHandle)}`
        );

        if (!isActive) {
          return;
        }

        setProfile(response);
      } catch (loadError) {
        if (!isActive) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this profile."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, [sanitizedHandle]);

  useEffect(() => {
    if (!token || !profile?.user?.handle) {
      return;
    }

    if (viewer?.handle === profile.user.handle) {
      return;
    }

    let isActive = true;
    setRelationshipLoading(true);
    setRelationshipError(null);

    apiGet<{ status: RelationshipStatus }>(
      `/friends/relationship/${encodeURIComponent(profile.user.handle)}`,
      token
    )
      .then((payload) => {
        if (!isActive) {
          return;
        }
        setRelationship(payload.status);
      })
      .catch((relError) => {
        if (!isActive) {
          return;
        }
        setRelationshipError(
          relError instanceof Error
            ? relError.message
            : "Unable to load relationship."
        );
      })
      .finally(() => {
        if (isActive) {
          setRelationshipLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [profile?.user?.handle, token, viewer?.handle]);

  const madlibAnswer = useMemo(
    () => buildMadlibAnswer(profile?.answers ?? null),
    [profile?.answers]
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-2">
        <Card className="py-10 text-center text-sm text-muted">
          Loading profile...
        </Card>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-2">
        <Card className="border border-accent/30 bg-accent/10 py-6 text-center text-sm font-semibold text-accent">
          {error ?? "Profile not found."}
        </Card>
      </div>
    );
  }

  const { user, answers } = profile;
  const collegeLabel =
    user.collegeName ??
    deriveCollegeFromDomain(user.collegeDomain ?? "");
  const isSelf = viewer?.handle === user.handle;

  const runRelationshipAction = async (
    action: () => Promise<void>,
    nextStatus: RelationshipStatus
  ) => {
    setRelationshipError(null);
    setRelationshipLoading(true);
    try {
      await action();
      setRelationship(nextStatus);
    } catch (relError) {
      setRelationshipError(
        relError instanceof Error
          ? relError.message
          : "Unable to update connection."
      );
    } finally {
      setRelationshipLoading(false);
    }
  };

  const handleConnect = () => {
    if (!isAuthenticated) {
      openAuthModal("signup");
      return;
    }
    if (!token) {
      return;
    }
    runRelationshipAction(
      () =>
        apiPost(
          "/friends/requests",
          { handle: user.handle },
          token
        ).then(() => undefined),
      "outgoing"
    );
  };

  const handleAccept = () => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    runRelationshipAction(
      () =>
        apiPost(
          `/friends/requests/accept/${encodeURIComponent(user.handle)}`,
          {},
          token
        ).then(() => undefined),
      "friends"
    );
  };

  const handleDecline = () => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    runRelationshipAction(
      () =>
        apiDelete(
          `/friends/requests/with/${encodeURIComponent(user.handle)}`,
          token
        ).then(() => undefined),
      "none"
    );
  };

  const handleRemoveFriend = () => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    runRelationshipAction(
      () =>
        apiDelete(`/friends/${encodeURIComponent(user.handle)}`, token).then(
          () => undefined
        ),
      "none"
    );
  };

  const handleBlock = () => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    runRelationshipAction(
      () =>
        apiPost(
          `/friends/block/${encodeURIComponent(user.handle)}`,
          {},
          token
        ).then(() => undefined),
      "blocked"
    );
  };

  const handleUnblock = () => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    runRelationshipAction(
      () =>
        apiDelete(`/friends/block/${encodeURIComponent(user.handle)}`, token).then(
          () => undefined
        ),
      "none"
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-2">
      <Card className="relative overflow-hidden">
        <div className="absolute -right-16 -top-12 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
        <div className="absolute -bottom-10 left-16 h-24 w-24 rounded-full bg-accent-2/20 blur-2xl" />
        <div className="relative flex flex-wrap items-center gap-4">
          <Avatar name={user.name} size={72} className="text-2xl" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-2xl font-semibold text-ink">
                {user.name}
              </p>
              {collegeLabel && (
                <span className="text-xs font-semibold text-muted">
                  {collegeLabel}
                </span>
              )}
            </div>
            <p className="text-sm text-muted">{user.handle}</p>
          </div>
          {!isSelf && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              {relationship === "blocked" ? (
                <Button
                  variant="outline"
                  requiresAuth={true}
                  onClick={handleUnblock}
                  disabled={isRelationshipLoading}
                >
                  Unblock
                </Button>
              ) : relationship === "blocked_by" ? (
                <Button variant="outline" requiresAuth={false} disabled={true}>
                  Blocked
                </Button>
              ) : relationship === "friends" ? (
                <>
                  <Button
                    variant="outline"
                    requiresAuth={true}
                    onClick={handleRemoveFriend}
                    disabled={isRelationshipLoading}
                  >
                    Remove friend
                  </Button>
                  <Button
                    variant="outline"
                    requiresAuth={true}
                    onClick={handleBlock}
                    disabled={isRelationshipLoading}
                  >
                    Block
                  </Button>
                </>
              ) : relationship === "incoming" ? (
                <>
                  <Button
                    requiresAuth={true}
                    onClick={handleAccept}
                    disabled={isRelationshipLoading}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="outline"
                    requiresAuth={true}
                    onClick={handleDecline}
                    disabled={isRelationshipLoading}
                  >
                    Decline
                  </Button>
                </>
              ) : relationship === "outgoing" ? (
                <>
                  <Button variant="outline" requiresAuth={false} disabled={true}>
                    Pending
                  </Button>
                  <Button
                    variant="outline"
                    requiresAuth={true}
                    onClick={handleDecline}
                    disabled={isRelationshipLoading}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    requiresAuth={true}
                    onClick={handleConnect}
                    disabled={isRelationshipLoading}
                  >
                    Connect
                  </Button>
                  <Button
                    variant="outline"
                    requiresAuth={true}
                    onClick={handleBlock}
                    disabled={isRelationshipLoading}
                  >
                    Block
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
        {relationshipError && (
          <p className="mt-3 text-xs font-semibold text-accent">
            {relationshipError}
          </p>
        )}
      </Card>

      <div className="grid gap-5 md:grid-cols-3">
        <ProfileQuestionCard
          title="If you guaranteed success, what career would you chose?"
          answer={answers?.career}
        />
        <ProfileQuestionCard
          title="Whenever I'm ____, my ____ stop and ____."
          answer={madlibAnswer}
        />
        <ProfileQuestionCard
          title="What's your favorite memory?"
          answer={answers?.memory}
        />
      </div>
    </div>
  );
};
