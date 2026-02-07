"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicUserLocation } from "@lockedin/shared";
import { Button } from "@/components/Button";

const toHandleSlug = (handle: string) => handle.replace(/^@/, "").trim();

const toInitials = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

type PublicUserPopupProps = {
  user: PublicUserLocation;
  onClose: () => void;
  onAddFriend: (userId: string) => Promise<void>;
  isFriend: boolean;
};

export const PublicUserPopup = ({
  user,
  onClose,
  onAddFriend,
  isFriend,
}: PublicUserPopupProps) => {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    setRequestSent(false);
    setIsSending(false);
  }, [user.userId]);

  const handleClose = () => {
    setIsVisible(false);
    window.setTimeout(onClose, 180);
  };

  const handleAddFriend = async () => {
    if (!user.userId) {
      return;
    }
    setIsSending(true);
    try {
      await onAddFriend(user.userId);
      setRequestSent(true);
    } finally {
      setIsSending(false);
    }
  };

  const handleViewProfile = () => {
    if (!user.handle) {
      return;
    }
    router.push(`/profile/${encodeURIComponent(toHandleSlug(user.handle))}`);
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
            {user.profilePictureUrl ? (
              <img
                src={user.profilePictureUrl}
                alt={user.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-3xl font-semibold text-ink/70">
                {toInitials(user.name)}
              </span>
            )}
          </div>
          <h3 className="mt-4 text-xl font-semibold text-ink">{user.name}</h3>
          <p className="text-sm font-semibold text-muted">{user.handle}</p>
          {user.bio && (
            <p className="mt-3 text-sm text-ink/70">{user.bio}</p>
          )}
          <div className="mt-3 space-y-1 text-xs text-muted">
            {user.collegeName && <p>🎓 {user.collegeName}</p>}
            {user.collegeDomain && <p>🏫 {user.collegeDomain}</p>}
            {user.mutualFriendsCount != null && user.mutualFriendsCount > 0 && (
              <p>👥 {user.mutualFriendsCount} mutual friends</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            requiresAuth={false}
            variant="outline"
            className="min-h-[44px] flex-1"
            onClick={handleViewProfile}
          >
            View Profile
          </Button>
          {isFriend ? (
            <Button
              requiresAuth={false}
              className="min-h-[44px] flex-1"
              onClick={() => router.push("/messages")}
            >
              Message
            </Button>
          ) : requestSent ? (
            <div className="flex min-h-[44px] flex-1 items-center justify-center rounded-xl border border-ink/10 text-xs font-semibold text-muted">
              ✓ Request sent
            </div>
          ) : (
            <Button
              requiresAuth={false}
              className="min-h-[44px] flex-1"
              onClick={handleAddFriend}
              disabled={isSending}
            >
              {isSending ? "Sending..." : "Add Friend"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
