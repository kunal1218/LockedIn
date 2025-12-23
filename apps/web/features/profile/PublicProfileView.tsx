"use client";

import { useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { apiGet } from "@/lib/api";
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
  const [profile, setProfile] = useState<PublicProfilePayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sanitizedHandle = handle.trim();

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

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pb-16 pt-2">
      <Card className="relative overflow-hidden">
        <div className="absolute -right-16 -top-12 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
        <div className="absolute -bottom-10 left-16 h-24 w-24 rounded-full bg-accent-2/20 blur-2xl" />
        <div className="relative flex items-center gap-4">
          <Avatar name={user.name} size={72} className="text-2xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-2xl font-semibold text-ink">
                {user.name}
              </p>
              {collegeLabel && (
                <Tag tone="mint" className="px-2 py-0 text-[10px]">
                  {collegeLabel}
                </Tag>
              )}
            </div>
            <p className="text-sm text-muted">{user.handle}</p>
          </div>
        </div>
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
