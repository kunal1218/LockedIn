"use client";

import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import { apiPost } from "@/lib/api";
import { deriveCollegeFromEmail } from "@/lib/college";
import { profile } from "./mock";

type MovementMode = "relative" | "absolute";

type ProfileHeaderProps = {
  isEditing?: boolean;
  movementMode?: MovementMode;
  onEditToggle?: () => void;
  onSaveLayout?: () => void;
  onCancelLayout?: () => void;
  onMovementModeChange?: (mode: MovementMode) => void;
  layoutError?: string | null;
};

const toggleBaseClasses =
  "rounded-full px-3 py-1 text-xs font-semibold transition";

export const ProfileHeader = ({
  isEditing = false,
  movementMode = "relative",
  onEditToggle,
  onSaveLayout,
  onCancelLayout,
  onMovementModeChange,
  layoutError,
}: ProfileHeaderProps) => {
  const { user, token, openAuthModal, refreshUser } = useAuth();
  const [isGrantingCoins, setGrantingCoins] = useState(false);
  const [coinGrantMessage, setCoinGrantMessage] = useState<string | null>(null);
  const displayName = user?.name ?? profile.name;
  const displayHandle = user?.handle ?? profile.handle;
  const displayCollege =
    user?.collegeName ?? (user?.email ? deriveCollegeFromEmail(user.email) : null);
  const showGrantCoins = Boolean(user?.isAdmin);

  const handleGrantCoins = async (amount: number) => {
    if (!user?.id) {
      return;
    }
    if (!token) {
      openAuthModal("login");
      return;
    }
    setGrantingCoins(true);
    setCoinGrantMessage(null);
    try {
      await apiPost(`/admin/users/${encodeURIComponent(user.id)}/coins`, { amount }, token);
      await refreshUser();
      setCoinGrantMessage(`Added ${amount.toLocaleString()} coins.`);
    } catch (error) {
      setCoinGrantMessage(
        error instanceof Error ? error.message : "Unable to grant coins."
      );
    } finally {
      setGrantingCoins(false);
    }
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-16 -top-12 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
      <div className="absolute -bottom-10 left-16 h-24 w-24 rounded-full bg-accent-2/20 blur-2xl" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size={72} className="text-2xl" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-2xl font-semibold text-ink">
                {displayName}
              </p>
            </div>
            <p className="text-sm text-muted">
              {displayHandle}
              {displayCollege && (
                <span className="text-muted">
                  <span className="px-2" aria-hidden="true">
                    ·
                  </span>
                  {displayCollege}
                </span>
              )}
            </p>
            <p className="mt-2 text-sm text-ink/80">{profile.bio}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {profile.badges.map((badge) => (
                <Tag key={badge} tone="sun">
                  {badge}
                </Tag>
              ))}
            </div>
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          {showGrantCoins && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                Grant coins
              </span>
              {[100, 1000, 10000, 100000].map((amount) => (
                <Button
                  key={`grant-self-${amount}`}
                  variant="outline"
                  requiresAuth={true}
                  onClick={() => handleGrantCoins(amount)}
                  disabled={isGrantingCoins}
                >
                  +{amount.toLocaleString()}
                </Button>
              ))}
            </div>
          )}
          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-full border border-card-border/70 bg-white/80 p-1">
                <button
                  type="button"
                  className={`${toggleBaseClasses} ${
                    movementMode === "relative"
                      ? "bg-accent/15 text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                  onClick={() => onMovementModeChange?.("relative")}
                >
                  Relative
                </button>
                <button
                  type="button"
                  className={`${toggleBaseClasses} ${
                    movementMode === "absolute"
                      ? "bg-accent/15 text-ink"
                      : "text-muted hover:text-ink"
                  }`}
                  onClick={() => onMovementModeChange?.("absolute")}
                >
                  Absolute
                </button>
              </div>
              <Button variant="profile" requiresAuth={false} onClick={onSaveLayout}>
                Save layout
              </Button>
              <Button variant="outline" requiresAuth={false} onClick={onCancelLayout}>
                Cancel
              </Button>
            </div>
          ) : (
            <>
              <Button variant="profile" onClick={onEditToggle}>
                Customize
              </Button>
              <Button variant="profile">Share vibe</Button>
            </>
          )}
          {coinGrantMessage && (
            <p className="text-xs font-semibold text-emerald-600">
              {coinGrantMessage}
            </p>
          )}
        </div>
      </div>
      {isEditing && layoutError && (
        <p className="mt-4 text-xs font-semibold text-accent">{layoutError}</p>
      )}
    </Card>
  );
};
