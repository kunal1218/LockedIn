import type { RequestCard as RequestCardType } from "@lockedin/shared";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { formatRelativeTime } from "@/lib/time";

const urgencyTone = {
  low: "default",
  medium: "sun",
  high: "accent",
} as const;

type RequestCardProps = {
  request: RequestCardType;
};

export const RequestCard = ({ request }: RequestCardProps) => {
  const urgency = request.urgency ?? "low";

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
        <Button variant="outline">I can help</Button>
      </div>
    </Card>
  );
};
