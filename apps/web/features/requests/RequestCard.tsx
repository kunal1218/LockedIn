import type { RequestCard as RequestCardType } from "@lockedin/shared";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { formatRelativeTime } from "@/lib/time";
import { deriveCollegeFromDomain } from "@/lib/college";

type RequestCardProps = {
  request: RequestCardType;
  onHelp?: (request: RequestCardType) => void | Promise<void>;
  isHelping?: boolean;
  hasHelped?: boolean;
  isOwnRequest?: boolean;
  onLike?: (request: RequestCardType) => void | Promise<void>;
  isLiking?: boolean;
  onDelete?: (request: RequestCardType) => void | Promise<void>;
};

export const RequestCard = ({
  request,
  onHelp,
  isHelping = false,
  hasHelped = false,
  isOwnRequest = false,
  onLike,
  isLiking = false,
  onDelete,
}: RequestCardProps) => {
  const urgency = request.urgency ?? "low";
  const collegeLabel = deriveCollegeFromDomain(
    request.creator.collegeDomain ?? ""
  );
  const locationLabel = request.isRemote
    ? "Remote"
    : request.city
      ? `${request.city} · ${request.location}`
      : request.location;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-muted">
            Posted by{" "}
            <span className="font-semibold text-ink">{request.creator.handle}</span>
            {collegeLabel ? ` · ${collegeLabel}` : ""}
          </p>
          {isOwnRequest && (
            <button
              type="button"
              aria-label="Delete request"
              className="flex h-5 w-5 items-center justify-center text-muted transition hover:text-accent"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(request);
              }}
            >
              🗑️
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isOwnRequest && (
            <button
              type="button"
              aria-label="Offer help"
              className={`inline-flex items-center justify-center rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold transition ${
                hasHelped
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "text-muted hover:border-emerald-400 hover:text-emerald-600"
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onHelp?.(request);
              }}
              disabled={isHelping}
            >
              ✓
            </button>
          )}
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold transition ${
              request.likedByUser
                ? "border-accent/50 text-accent"
                : "text-muted hover:border-accent/40 hover:text-ink"
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onLike?.(request);
            }}
            disabled={isLiking}
          >
            <span className="inline-block min-w-[14px] text-center">
              {request.likedByUser ? "♥" : "♡"}
            </span>
            <span className="inline-block min-w-[10px] text-center">
              {request.likeCount}
            </span>
          </button>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-ink">{request.title}</h3>
        <p className="text-sm text-muted">{request.description}</p>
      </div>
      <div className="flex items-center justify-between gap-3 pt-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-muted">
          <span>{locationLabel}</span>
          <span className="h-1 w-1 rounded-full bg-card-border/70" />
          <span className="capitalize">{urgency} urgency</span>
        </div>
        <span className="text-xs text-muted">
          {formatRelativeTime(request.createdAt)}
        </span>
      </div>
    </Card>
  );
};
