"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/Button";
import { apiPost } from "@/lib/api";
import { useAuth } from "./AuthProvider";

const inputClasses =
  "mt-2 w-full rounded-2xl border border-card-border/80 bg-white/80 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

const labelClasses = "text-xs font-semibold uppercase tracking-[0.2em] text-muted";

const GoogleIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-4 w-4"
    fill="none"
  >
    <path
      d="M23.12 12.27c0-.74-.07-1.45-.2-2.13H12v4.04h6.24a5.34 5.34 0 0 1-2.31 3.5v2.9h3.73c2.18-2.02 3.46-4.99 3.46-8.31Z"
      fill="#4285F4"
    />
    <path
      d="M12 24c3.12 0 5.74-1.03 7.66-2.79l-3.73-2.9c-1.03.69-2.35 1.1-3.93 1.1-3 0-5.54-2.03-6.45-4.77H1.7v2.99A11.99 11.99 0 0 0 12 24Z"
      fill="#34A853"
    />
    <path
      d="M5.55 14.64a7.2 7.2 0 0 1 0-5.28V6.37H1.7a12 12 0 0 0 0 11.26l3.85-2.99Z"
      fill="#FBBC05"
    />
    <path
      d="M12 4.77c1.7 0 3.23.58 4.43 1.72l3.32-3.32C17.73 1.02 15.12 0 12 0A11.99 11.99 0 0 0 1.7 6.37l3.85 2.99C6.46 6.8 9 4.77 12 4.77Z"
      fill="#EA4335"
    />
  </svg>
);

export const AuthModal = () => {
  const {
    isAuthModalOpen,
    closeAuthModal,
    authModalMode,
    setAuthModalMode,
    login,
    signup,
  } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const modeCopy = useMemo(
    () =>
      authModalMode === "login"
        ? {
            title: "Welcome back",
            subtitle: "Sign in to keep the momentum rolling.",
            action: "Sign in",
            toggle: "Need an account?",
            toggleAction: "Create one",
            showPassword: true,
          }
        : authModalMode === "signup"
        ? {
            title: "Jump into the action",
            subtitle: "Create your profile and start connecting.",
            action: "Create account",
            toggle: "Already have an account?",
            toggleAction: "Sign in",
            showPassword: true,
          }
        : {
            title: "Reset your password",
            subtitle: "Tell us your email and we’ll send a reset link.",
            action: "Send reset link",
            toggle: "Remembered it?",
            toggleAction: "Back to sign in",
            showPassword: false,
          },
    [authModalMode]
  );

  useEffect(() => {
    if (!isAuthModalOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAuthModalOpen]);

  useEffect(() => {
    if (isAuthModalOpen) {
      setPending(false);
      setError(null);
      setInfo(null);
      setPassword("");
    }
  }, [authModalMode, isAuthModalOpen]);

  if (!isAuthModalOpen) {
    return null;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError(null);
    setInfo(null);

    try {
      if (authModalMode === "login") {
        await login({ email, password });
        closeAuthModal();
        return;
      }

      if (authModalMode === "signup") {
        await signup({
          name,
          email,
          password,
          handle: handle.trim() ? handle : undefined,
        });
        closeAuthModal();
        router.push("/profile");
        return;
      }

      await apiPost("/auth/forgot", { email });
      setInfo(
        "If an account exists for that email, you’ll get a link to reset your password."
      );
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Try again.";
      setError(message);
    } finally {
      setPending(false);
    }
  };

  const switchMode = () => {
    if (authModalMode === "login") {
      setAuthModalMode("signup");
      return;
    }
    setAuthModalMode("login");
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8">
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={closeAuthModal}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-[28px] border border-card-border/70 bg-white/95 shadow-[0_32px_80px_rgba(27,26,23,0.18)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <div className="grid gap-6 p-6 md:p-8">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-muted">
                LockedIn Access
              </p>
              <h2
                id="auth-modal-title"
                className="mt-3 font-display text-2xl font-semibold text-ink"
              >
                {modeCopy.title}
              </h2>
              <p className="mt-2 text-sm text-muted">{modeCopy.subtitle}</p>
            </div>
            <button
              type="button"
              className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
              onClick={closeAuthModal}
            >
              Close
            </button>
          </div>

          <div className="rounded-[20px] border border-card-border/70 bg-white/80 p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/15 text-base font-semibold text-accent">
                L
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">
                  Campus energy, zero awkwardness
                </p>
                <p className="text-xs text-muted">
                  Jump into challenges, chats, and collabs instantly.
                </p>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            requiresAuth={false}
            className="w-full justify-center gap-3 border-card-border bg-white/90 text-ink hover:border-accent/60"
            disabled
          >
            <GoogleIcon />
            Continue with Google (soon)
          </Button>

          <div className="flex items-center gap-3 text-xs font-semibold text-muted">
            <span className="h-px flex-1 bg-card-border/70" />
            or
            <span className="h-px flex-1 bg-card-border/70" />
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {authModalMode === "signup" && (
              <>
                <label className="block">
                  <span className={labelClasses}>Name</span>
                  <input
                    className={inputClasses}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Avery Cho"
                    autoComplete="name"
                    required
                  />
                </label>
                <label className="block">
                  <span className={labelClasses}>Handle (optional)</span>
                  <input
                    className={inputClasses}
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    placeholder="@averycodes"
                    autoComplete="username"
                  />
                </label>
              </>
            )}
            <label className="block">
              <span className={labelClasses}>Email</span>
              <input
                className={inputClasses}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@school.edu"
                autoComplete="email"
                required
              />
            </label>
            {modeCopy.showPassword && (
              <label className="block">
                <div className="flex items-center justify-between">
                  <span className={labelClasses}>Password</span>
                  {authModalMode === "login" && (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-accent hover:text-ink"
                      onClick={() => setAuthModalMode("forgot")}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  className={inputClasses}
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete={
                    authModalMode === "login" ? "current-password" : "new-password"
                  }
                  minLength={8}
                  required
                />
              </label>
            )}

            {error && (
              <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs font-semibold text-ink">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-2xl border border-accent/25 bg-accent/5 px-4 py-3 text-xs font-semibold text-ink/80">
                {info}
              </div>
            )}

            <Button
              type="submit"
              requiresAuth={false}
              className="w-full"
              disabled={pending}
            >
              {pending ? "Hold tight..." : modeCopy.action}
            </Button>
          </form>

          <div className="text-center text-sm text-muted">
            {modeCopy.toggle}{" "}
            <button
              type="button"
              className="font-semibold text-ink transition hover:text-accent"
              onClick={switchMode}
            >
              {modeCopy.toggleAction}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
