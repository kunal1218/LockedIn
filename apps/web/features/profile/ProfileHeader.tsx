"use client";

import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import { profile } from "./mock";

type MovementMode = "relative" | "absolute";

type ProfileHeaderProps = {
  isEditing?: boolean;
  movementMode?: MovementMode;
  onEditToggle?: () => void;
  onSaveLayout?: () => void;
  onCancelLayout?: () => void;
  onMovementModeChange?: (mode: MovementMode) => void;
  onEditAnswers?: () => void;
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
  onEditAnswers,
  layoutError,
}: ProfileHeaderProps) => {
  const { user } = useAuth();
  const displayName = user?.name ?? profile.name;
  const displayHandle = user?.handle ?? profile.handle;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute -right-16 -top-12 h-32 w-32 rounded-full bg-accent/20 blur-2xl" />
      <div className="absolute -bottom-10 left-16 h-24 w-24 rounded-full bg-accent-2/20 blur-2xl" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <Avatar name={displayName} size={72} className="text-2xl" />
          <div>
            <p className="font-display text-2xl font-semibold text-ink">
              {displayName}
            </p>
            <p className="text-sm text-muted">{displayHandle}</p>
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
        <div className="flex flex-wrap gap-3">
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
              {onEditAnswers && (
                <Button
                  variant="outline"
                  requiresAuth={false}
                  onClick={onEditAnswers}
                >
                  Edit answers
                </Button>
              )}
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
                Edit profile
              </Button>
              <Button variant="profile">Share vibe</Button>
            </>
          )}
        </div>
      </div>
      {isEditing && layoutError && (
        <p className="mt-4 text-xs font-semibold text-accent">{layoutError}</p>
      )}
    </Card>
  );
};
