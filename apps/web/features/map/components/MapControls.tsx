"use client";

import { Button } from "@/components/Button";

type MapControlsProps = {
  isAuthenticated: boolean;
  shareLocation: boolean;
  ghostMode: boolean;
  onToggleShare: () => void;
  onToggleGhost: () => void;
  onLogin: () => void;
  error?: string | null;
  isLoading?: boolean;
};

export const MapControls = ({
  isAuthenticated,
  shareLocation,
  ghostMode,
  onToggleShare,
  onToggleGhost,
  onLogin,
  error,
  isLoading,
}: MapControlsProps) => {
  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 flex w-[260px] flex-col gap-3">
      <div className="pointer-events-auto rounded-2xl border border-card-border/60 bg-white/85 p-4 text-xs text-ink/80 shadow-[0_18px_40px_rgba(27,26,23,0.18)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Share my location</p>
            <p className="mt-1 text-[11px] text-muted">
              Your friends can see you for the next 30 minutes.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={shareLocation}
            className={`relative h-11 w-16 rounded-full transition ${
              shareLocation ? "bg-accent" : "bg-ink/10"
            }`}
            onClick={onToggleShare}
          >
            <span
              className={`absolute top-2 h-7 w-7 rounded-full bg-white transition ${
                shareLocation ? "left-8" : "left-2"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="pointer-events-auto rounded-2xl border border-card-border/60 bg-white/85 p-4 text-xs text-ink/80 shadow-[0_18px_40px_rgba(27,26,23,0.18)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-ink">Go ghost 👻</p>
            <p className="mt-1 text-[11px] text-muted">
              Hide instantly without toggling sharing off.
            </p>
          </div>
          <button
            type="button"
            className={`min-h-[44px] rounded-full border px-4 py-2 text-[11px] font-semibold transition ${
              ghostMode
                ? "border-accent bg-accent/15 text-accent"
                : "border-card-border/70 text-ink/70 hover:border-accent/40"
            }`}
            onClick={onToggleGhost}
          >
            {ghostMode ? "Ghosted" : "Go ghost"}
          </button>
        </div>
      </div>

      {!isAuthenticated && (
        <div className="pointer-events-auto">
          <Button requiresAuth={false} className="w-full" onClick={onLogin}>
            Log in to share
          </Button>
        </div>
      )}

      {error && (
        <div className="pointer-events-auto rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs font-semibold text-accent">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="pointer-events-auto rounded-2xl border border-card-border/60 bg-white/80 px-4 py-3 text-xs text-muted backdrop-blur">
          Loading friend locations...
        </div>
      )}
    </div>
  );
};
