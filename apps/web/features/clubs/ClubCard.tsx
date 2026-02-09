import { Card } from "@/components/Card";
import { formatRelativeTime } from "@/lib/time";
import type { Club } from "./types";

type ClubCardProps = {
  club: Club;
  onJoin?: (club: Club) => void | Promise<void>;
  isJoining?: boolean;
  hasJoined?: boolean;
  isOwnClub?: boolean;
};

export const ClubCard = ({
  club,
  onJoin,
  isJoining = false,
  hasJoined,
  isOwnClub = false,
}: ClubCardProps) => {
  const joined = typeof hasJoined === "boolean" ? hasJoined : Boolean(club.joinedByUser);
  const isApplication = club.joinPolicy === "application";
  const applicationStatus = club.applicationStatus ?? null;
  const isPending = isApplication && applicationStatus === "pending";
  const isDenied = isApplication && applicationStatus === "denied";
  const locationLabel = club.isRemote
    ? "Remote"
    : club.city
      ? `${club.city} · ${club.location}`
      : club.location;
  const distanceLabel =
    !club.isRemote && club.distanceKm != null
      ? `${club.distanceKm.toFixed(1)} km away`
      : null;

  return (
    <Card className="overflow-hidden p-0">
      {club.imageUrl ? (
        <div className="relative h-40 w-full overflow-hidden">
          <img
            src={club.imageUrl}
            alt={club.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        </div>
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-amber-50 via-white to-emerald-50">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-muted">
            {club.category}
          </span>
        </div>
      )}
      <div className="space-y-3 px-4 pb-4 pt-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
            <span>{club.category}</span>
            <span className="h-1 w-1 rounded-full bg-card-border/70" />
            <span>{club.memberCount} members</span>
            {isApplication && (
              <>
                <span className="h-1 w-1 rounded-full bg-card-border/70" />
                <span>Application</span>
              </>
            )}
          </div>
          {!isOwnClub && (
            <button
              type="button"
              aria-label={joined ? "Leave club" : "Join club"}
              className={`inline-flex items-center justify-center rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold transition ${
                joined
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : isPending
                    ? "border-amber-300 bg-amber-100 text-amber-800"
                    : isDenied
                      ? "border-rose-300 bg-rose-50 text-rose-700"
                  : "text-muted hover:border-emerald-400 hover:text-emerald-600"
              }`}
              onClick={(event) => {
                event.stopPropagation();
                onJoin?.(club);
              }}
              disabled={isJoining || isPending}
            >
              {joined ? "✓" : isPending ? "Pending" : isDenied ? "Reapply" : "✓"}
            </button>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-ink">{club.title}</h3>
          <p className="text-sm text-muted">{club.description}</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <div className="flex flex-wrap items-center gap-2">
            <span>{locationLabel}</span>
            {distanceLabel && (
              <>
                <span className="h-1 w-1 rounded-full bg-card-border/70" />
                <span>{distanceLabel}</span>
              </>
            )}
          </div>
          <span>{formatRelativeTime(club.createdAt)}</span>
        </div>
      </div>
    </Card>
  );
};
