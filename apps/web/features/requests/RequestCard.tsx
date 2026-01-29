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
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted">
          Posted by{" "}
          <span className="font-semibold text-ink">{request.creator.handle}</span>
          {collegeLabel ? ` · ${collegeLabel}` : ""}
        </p>
        <button
          type="button"
          className={`rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold transition ${
            request.likedByUser
              ? "border-accent/50 text-accent"
              : "text-muted hover:border-accent/40 hover:text-ink"
          }`}
          onClick={() => onLike?.(request)}
          disabled={isLiking}
        >
          {isLiking ? "…" : request.likedByUser ? "♥" : "♡"} {request.likeCount}
        </button>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-ink">{request.title}</h3>
        <p className="mt-2 text-sm text-muted">{request.description}</p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <span>{locationLabel}</span>
          <span className="h-1 w-1 rounded-full bg-card-border/70" />
          <span className="capitalize">{urgency} urgency</span>
        </div>
        <div className="flex items-center gap-2">
          {isOwnRequest && (
            <button
              type="button"
              className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
              onClick={() => onDelete?.(request)}
            >
              Delete
            </button>
          )}
          <Button
            variant="outline"
            onClick={() => onHelp?.(request)}
            disabled={isHelping || hasHelped || isOwnRequest}
          >
            {isOwnRequest
              ? "Yours"
              : hasHelped
                ? "Help sent"
                : isHelping
                  ? "Sending..."
                  : "I can help"}
          </Button>
        </div>
      </div>
      <div className="flex items-center justify-end">
        <span className="text-xs text-muted">
          {formatRelativeTime(request.createdAt)}
        </span>
      </div>
    </Card>
  );
};
