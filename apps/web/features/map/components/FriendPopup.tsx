"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { FriendLocation } from "@lockedin/shared";
import { Button } from "@/components/Button";

const MAX_BIO_LENGTH = 120;

const toHandleSlug = (handle: string) => handle.replace(/^@/, "").trim();

const toDisplayBio = (bio?: string | null) => {
  const cleaned = bio?.trim() ?? "";
  if (!cleaned) {
    return "No bio yet.";
  }
  if (cleaned.length <= MAX_BIO_LENGTH) {
    return cleaned;
  }
  return `${cleaned.slice(0, MAX_BIO_LENGTH - 3)}...`;
};

const toInitials = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

const getDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

export const FriendPopup = ({
  friend,
  onClose,
}: {
  friend: FriendLocation;
  onClose: () => void;
}) => {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setIsVisible(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  const activity = useMemo(() => {
    if (
      friend.previousLatitude == null ||
      friend.previousLongitude == null ||
      friend.latitude == null ||
      friend.longitude == null
    ) {
      return null;
    }

    const distance = getDistanceMeters(
      friend.latitude,
      friend.longitude,
      friend.previousLatitude,
      friend.previousLongitude
    );
    if (!Number.isFinite(distance)) {
      return null;
    }
    return distance > 50 ? "🚶 Moving" : "📍 Nearby";
  }, [friend]);

  const handleClose = () => {
    setIsVisible(false);
    window.setTimeout(onClose, 180);
  };

  const handleMessage = () => {
    router.push("/messages");
  };

  const handleProfile = () => {
    router.push(`/profile/${encodeURIComponent(toHandleSlug(friend.handle))}`);
  };

  return (
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center px-4 transition-opacity duration-200 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur" />
      <div
        className={`relative z-10 w-full max-w-md rounded-[28px] border border-card-border/60 bg-white/90 p-6 shadow-[0_24px_60px_rgba(27,26,23,0.2)] backdrop-blur transition-transform duration-200 ${
          isVisible ? "scale-100" : "scale-95"
        }`}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full border border-card-border/70 text-ink/70 transition hover:border-accent/40 hover:text-ink"
          onClick={handleClose}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-ink/10 shadow-[0_18px_40px_rgba(27,26,23,0.2)]">
            {friend.profilePictureUrl ? (
              <img
                src={friend.profilePictureUrl}
                alt={friend.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-semibold text-ink/70">
                {toInitials(friend.name)}
              </span>
            )}
          </div>
          <h3 className="mt-4 text-xl font-semibold text-ink">{friend.name}</h3>
          <p className="text-sm font-semibold text-muted">{friend.handle}</p>
          <p className="mt-3 text-sm text-ink/70">{toDisplayBio(friend.bio)}</p>
          {activity && (
            <div className="mt-3 rounded-full bg-ink/10 px-3 py-1 text-xs font-semibold text-ink/70">
              {activity}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            requiresAuth={false}
            className="min-h-[44px] flex-1"
            onClick={handleMessage}
          >
            Message
          </Button>
          <Button
            requiresAuth={false}
            variant="outline"
            className="min-h-[44px] flex-1"
            onClick={handleProfile}
          >
            View Profile
          </Button>
        </div>
      </div>
    </div>
  );
};
