"use client";

import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { Button } from "@/components/Button";

type MapControlsProps = {
  isAuthenticated: boolean;
  shareLocation: boolean;
  ghostMode: boolean;
  publicMode: boolean;
  isEmbedded?: boolean;
  isPlacingPin?: boolean;
  onToggleShare: () => void;
  onToggleGhost: () => void;
  onTogglePublic: () => void;
  onToggleCreateEvent?: () => void;
  showCreateEvent?: boolean;
  onLogin: () => void;
  onRetry?: () => void;
  error?: string | null;
  isLoading?: boolean;
};

export const MapControls = ({
  isAuthenticated,
  shareLocation,
  ghostMode,
  publicMode,
  isEmbedded = false,
  isPlacingPin,
  onToggleShare,
  onToggleGhost,
  onTogglePublic,
  onToggleCreateEvent,
  showCreateEvent = true,
  onLogin,
  onRetry,
  error,
  isLoading,
}: MapControlsProps) => {
  const [status, setStatus] = useState<"connected" | "connecting" | "disconnected">(
    socket.connected ? "connected" : "disconnected"
  );

  useEffect(() => {
    const handleConnect = () => setStatus("connected");
    const handleDisconnect = () => setStatus("disconnected");
    const handleConnecting = () => setStatus("connecting");

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnecting);
    socket.io.on("reconnect_attempt", handleConnecting);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnecting);
      socket.io.off("reconnect_attempt", handleConnecting);
    };
  }, []);

  const statusColor =
    status === "connected"
      ? "#10b981"
      : status === "connecting"
        ? "#f59e0b"
        : "#ef4444";
  const statusLabel =
    status === "connected"
      ? "Connected"
      : status === "connecting"
        ? "Connecting..."
        : "Disconnected";
  const shellClass = isEmbedded
    ? "pointer-events-none absolute right-3 top-3 z-20 flex w-[210px] flex-col gap-2 sm:w-[220px]"
    : "pointer-events-none absolute right-4 top-4 z-20 flex w-[260px] flex-col gap-3";
  const cardClass = isEmbedded
    ? "pointer-events-auto rounded-2xl border border-black/10 bg-white/95 p-3 text-[10px] text-[#6B7280] shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur"
    : "pointer-events-auto rounded-2xl border border-black/10 bg-white/95 p-4 text-xs text-[#6B7280] shadow-[0_2px_8px_rgba(0,0,0,0.12)] backdrop-blur";

  return (
    <div className={shellClass}>
      <div className="pointer-events-auto flex items-center justify-end">
        <span
          title={statusLabel}
          className="h-2 w-2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.2)]"
          style={{ backgroundColor: statusColor }}
        />
      </div>
      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={isEmbedded ? "text-[13px] font-semibold text-[#1F2937]" : "text-sm font-semibold text-[#1F2937]"}>
              Share my location
            </p>
            <p className={isEmbedded ? "mt-0.5 text-[10px] text-[#6B7280]" : "mt-1 text-[11px] text-[#6B7280]"}>
              Your friends can see your latest shared location.
            </p>
          </div>
          <button
            type="button"
            aria-pressed={shareLocation}
            className={`relative rounded-full transition ${
              isEmbedded ? "h-8 w-12" : "h-11 w-16"
            } ${
              shareLocation ? "bg-accent" : "bg-ink/10"
            }`}
            onClick={onToggleShare}
          >
            <span
              className={`absolute rounded-full bg-white transition ${
                isEmbedded ? "top-1.5 h-5 w-5" : "top-2 h-7 w-7"
              } ${
                shareLocation ? (isEmbedded ? "left-6" : "left-8") : (isEmbedded ? "left-1.5" : "left-2")
              }`}
            />
          </button>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={isEmbedded ? "text-[13px] font-semibold text-[#1F2937]" : "text-sm font-semibold text-[#1F2937]"}>
              Go ghost 👻
            </p>
            <p className={isEmbedded ? "mt-0.5 text-[10px] text-[#6B7280]" : "mt-1 text-[11px] text-[#6B7280]"}>
              Hide instantly without toggling sharing off.
            </p>
          </div>
          <button
            type="button"
            className={`rounded-full border font-semibold transition ${
              isEmbedded ? "min-h-[34px] px-3 py-1 text-[10px]" : "min-h-[44px] px-4 py-2 text-[11px]"
            } ${
              ghostMode
                ? "border-accent bg-accent/15 text-accent"
                : "border-black/10 text-[#6B7280] hover:border-accent/40"
            }`}
            onClick={onToggleGhost}
          >
            {ghostMode ? "Ghosted" : "Go ghost"}
          </button>
        </div>
      </div>

      <div className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={isEmbedded ? "text-[13px] font-semibold text-[#1F2937]" : "text-sm font-semibold text-[#1F2937]"}>
              Go public 🌍
            </p>
            <p className={isEmbedded ? "mt-0.5 text-[10px] text-[#6B7280]" : "mt-1 text-[11px] text-[#6B7280]"}>
              Let anyone on campus see you.
            </p>
          </div>
          <button
            type="button"
            className={`rounded-full border font-semibold transition ${
              isEmbedded ? "min-h-[34px] px-3 py-1 text-[10px]" : "min-h-[44px] px-4 py-2 text-[11px]"
            } ${
              publicMode
                ? "border-accent bg-accent/15 text-accent"
                : "border-black/10 text-[#6B7280] hover:border-accent/40"
            } ${ghostMode ? "opacity-50" : ""}`}
            onClick={onTogglePublic}
            disabled={ghostMode}
            aria-pressed={publicMode}
          >
            {publicMode ? "Public" : "Private"}
          </button>
        </div>
      </div>

      {showCreateEvent && onToggleCreateEvent && (
        <div className="pointer-events-auto flex justify-end">
          <button
            type="button"
            onClick={onToggleCreateEvent}
            className={`flex items-center justify-center rounded-full font-bold text-white shadow-lg transition-all duration-200 ${
              isEmbedded ? "h-12 w-12 text-xl" : "h-14 w-14 text-2xl"
            } ${
              isPlacingPin
                ? "bg-red-500 hover:bg-red-600"
                : "bg-orange-500 hover:bg-orange-600"
            }`}
            title={isPlacingPin ? "Cancel" : "Create Event"}
            aria-label={isPlacingPin ? "Cancel pin drop" : "Create event"}
          >
            {isPlacingPin ? "×" : "+"}
          </button>
        </div>
      )}

      {!isAuthenticated && (
        <div className="pointer-events-auto">
          <Button requiresAuth={false} className="w-full" onClick={onLogin}>
            Log in to share
          </Button>
        </div>
      )}

      {error && (
        <div className="pointer-events-auto rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-xs font-semibold text-accent">
          <p>{error}</p>
          {onRetry && (
            <Button
              requiresAuth={false}
              variant="outline"
              className="mt-3 w-full min-h-[44px]"
              onClick={onRetry}
            >
              Retry
            </Button>
          )}
        </div>
      )}

      {isLoading && (
        <div className="pointer-events-auto rounded-2xl border border-black/10 bg-white/90 px-4 py-3 text-xs text-[#6B7280] backdrop-blur">
          Loading friend locations...
        </div>
      )}
    </div>
  );
};
