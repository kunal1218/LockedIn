"use client";

import { Suspense, useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { apiPost } from "@/lib/api";
import { useAuth } from "@/features/auth";

const inputClasses =
  "w-full rounded-2xl border border-card-border/80 bg-white/80 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

const ResetPasswordInner = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { openAuthModal } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const token = searchParams?.get("token") ?? "";

  useEffect(() => {
    setError(null);
    setSuccess(null);
    setPassword("");
    setConfirm("");
  }, [token]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!token) {
      setError("This reset link is missing or invalid.");
      return;
    }
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords must match.");
      return;
    }

    setPending(true);
    try {
      await apiPost("/auth/reset", { token, password });
      setSuccess("Password updated. You can sign in with your new password.");
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Unable to reset password. Try again.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  const openLogin = () => {
    openAuthModal("login");
    router.push("/");
  };

  const openRequest = () => {
    openAuthModal("forgot");
    router.push("/");
  };

  return (
    <div className="mx-auto max-w-lg px-4 pb-16 pt-10">
      <h1 className="font-display text-3xl font-semibold text-ink">Reset password</h1>
      <p className="mt-2 text-sm text-muted">
        Set a new password to get back into your account.
      </p>

      <Card className="mt-6 space-y-4 border border-card-border/70 bg-white/90 p-6 shadow-sm">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              New password
            </span>
            <input
              className={inputClasses}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
              Confirm password
            </span>
            <input
              className={inputClasses}
              type="password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              placeholder="Repeat your new password"
              minLength={8}
              required
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs font-semibold text-ink">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-2xl border border-accent/25 bg-accent/5 px-4 py-3 text-xs font-semibold text-ink/80">
              {success}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Saving..." : "Update password"}
          </Button>
        </form>

        <div className="flex flex-wrap gap-3 text-sm text-muted">
          <button
            type="button"
            className="font-semibold text-ink transition hover:text-accent"
            onClick={openLogin}
          >
            Return to sign in
          </button>
          <span>·</span>
          <button
            type="button"
            className="font-semibold text-ink transition hover:text-accent"
            onClick={openRequest}
          >
            Need a new link?
          </button>
        </div>
      </Card>
    </div>
  );
};

const ResetPasswordShell = ({ children }: { children: ReactNode }) => (
  <Suspense
    fallback={
      <div className="mx-auto max-w-lg px-4 pb-16 pt-10">
        <Card className="space-y-3 border border-card-border/70 bg-white/90 p-6 shadow-sm">
          <div className="h-6 w-40 rounded bg-card-border/70" />
          <div className="h-4 w-64 rounded bg-card-border/70" />
          <div className="h-24 w-full rounded-2xl bg-card-border/60" />
        </Card>
      </div>
    }
  >
    {children}
  </Suspense>
);

export default function ResetPasswordPage() {
  return (
    <ResetPasswordShell>
      <ResetPasswordInner />
    </ResetPasswordShell>
  );
}
