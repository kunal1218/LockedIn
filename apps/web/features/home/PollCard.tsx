import type { FeedPost } from "@lockedin/shared";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { formatRelativeTime } from "@/lib/time";

const getMaxVotes = (post: FeedPost) => {
  if (!post.pollOptions) return 0;
  return Math.max(...post.pollOptions.map((option) => option.votes), 0);
};

type PollCardProps = {
  post: FeedPost;
};

export const PollCard = ({ post }: PollCardProps) => {
  const maxVotes = getMaxVotes(post) || 1;

  return (
    <Card className="space-y-4">
      <div className="flex items-center gap-3">
        <Avatar name={post.author.name} />
        <div>
          <p className="text-sm font-semibold text-ink">{post.author.name}</p>
          <p className="text-xs text-muted">
            {post.author.handle} · {formatRelativeTime(post.createdAt)}
          </p>
        </div>
        <Tag tone="mint" className="ml-auto">
          Poll
        </Tag>
      </div>
      <div>
        <p className="text-base font-semibold text-ink">{post.content}</p>
        <div className="mt-4 space-y-3">
          {post.pollOptions?.map((option) => (
            <div
              key={option.id}
              className="rounded-2xl border border-card-border/70 bg-white/60 px-4 py-3"
            >
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>{option.label}</span>
                <span className="text-muted">{option.votes}</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-card-border/40">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${(option.votes / maxVotes) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
};
