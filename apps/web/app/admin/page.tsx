"use client";

import { useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiGet } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";

type AdminSubmission = {
  id: string;
  type: "daily-challenge";
  challengeId: string;
  challengeTitle: string;
  imageData: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    handle: string;
    email: string;
  };
};

type AdminSubmissionResponse = {
  submissions: AdminSubmission[];
};

export default function AdminPage() {
  const { isAuthenticated, openAuthModal, token, user } = useAuth();
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token || !user?.isAdmin) {
      return;
    }

    let isActive = true;
    setIsLoading(true);
    setError(null);

    apiGet<AdminSubmissionResponse>("/admin/attempts", token)
      .then((response) => {
        if (!isActive) {
          return;
        }
        setSubmissions(response.submissions);
      })
      .catch((loadError) => {
        if (!isActive) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load admin dashboard."
        );
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [token, user?.isAdmin]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-2">
        <Card className="flex flex-col items-start gap-4">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">
              Admin Dashboard
            </h1>
            <p className="text-sm text-muted">
              Sign in to review daily challenge submissions.
            </p>
          </div>
          <Button onClick={() => openAuthModal("login")}>
            Log in
          </Button>
        </Card>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-2">
        <Card className="border border-accent/30 bg-accent/10 py-6 text-center text-sm font-semibold text-accent">
          Admin access required.
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-2">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl font-semibold">Admin</h1>
          <p className="text-sm text-muted">
            Review daily challenge submissions as they come in.
          </p>
        </div>

        {isLoading ? (
          <Card className="py-6 text-center text-sm text-muted">
            Loading submissions...
          </Card>
        ) : error ? (
          <Card className="border border-accent/30 bg-accent/10 py-6 text-center text-sm font-semibold text-accent">
            {error}
          </Card>
        ) : submissions.length === 0 ? (
          <Card className="py-6 text-center text-sm text-muted">
            No challenge attempts yet.
          </Card>
        ) : (
          <div className="space-y-4">
            {submissions.map((submission) => (
              <Card key={submission.id} className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Avatar name={submission.user.name} size={36} />
                  <div>
                    <p className="text-sm font-semibold text-ink">
                      {submission.user.handle}
                    </p>
                    <p className="text-xs text-muted">
                      {submission.user.email} ·{" "}
                      {formatRelativeTime(submission.createdAt)}
                    </p>
                  </div>
                  <div className="ml-auto rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted">
                    Daily Challenge
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink">
                    {submission.challengeTitle}
                  </p>
                  <p className="text-xs text-muted">
                    Challenge ID: {submission.challengeId}
                  </p>
                </div>
                <div className="overflow-hidden rounded-2xl border border-card-border/70 bg-white">
                  <img
                    src={submission.imageData}
                    alt="Challenge attempt"
                    className="h-auto w-full object-cover"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
