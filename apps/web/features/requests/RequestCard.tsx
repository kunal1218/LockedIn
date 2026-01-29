import type { RequestCard as RequestCardType } from "@lockedin/shared";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { formatRelativeTime } from "@/lib/time";
import { deriveCollegeFromDomain } from "@/lib/college";

const urgencyTone = {
  low: "default",
  medium: "sun",
  high: "accent",
} as const;

type RequestCardProps = {
  request: RequestCardType;
  onHelp?: (request: RequestCardType) => void | Promise<void>;
  isHelping?: boolean;
  hasHelped?: boolean;
  isOwnRequest?: boolean;
  onLike?: (request: RequestCardType) => void | Promise<void>;
  isLiking?: boolean;
};

export const RequestCard = ({
  request,
  onHelp,
  isHelping = false,
  hasHelped = false,
  isOwnRequest = false,
  onLike,
  isLiking = false,
}: RequestCardProps) => {
  const urgency = request.urgency ?? "low";
  const collegeLabel = deriveCollegeFromDomain(
    request.creator.collegeDomain ?? ""
  );

  return (
    <Card className="space-y-4">
      <div className="flex items-center justify-between">
        <Tag tone={urgencyTone[urgency]}>{urgency} urgency</Tag>
        <span className="text-xs text-muted">
          {formatRelativeTime(request.createdAt)}
        </span>
      </div>
      <div>
        <h3 className="text-lg font-semibold text-ink">{request.title}</h3>
        <p className="text-sm text-muted">{request.description}</p>
        <p className="mt-2 text-xs text-muted">
          Posted by{" "}
          <span className="font-semibold text-ink">{request.creator.handle}</span>
          {collegeLabel ? ` · ${collegeLabel}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {request.tags.map((tag) => (
          <Tag key={tag}>{tag}</Tag>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted">
          <span>{request.location}</span>
          <span className="h-1 w-1 rounded-full bg-card-border/70" />
          <span className="capitalize">{urgency} urgency</span>
        </div>
        <div className="flex items-center gap-2">
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
    </Card>
  );
};
