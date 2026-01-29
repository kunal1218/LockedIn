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
};

export const RequestCard = ({
  request,
  onHelp,
  isHelping = false,
  hasHelped = false,
  isOwnRequest = false,
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
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted">
          {request.location}
        </span>
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
    </Card>
  );
};
