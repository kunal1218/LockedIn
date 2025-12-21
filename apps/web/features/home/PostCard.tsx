import type { FeedPost } from "@lockedin/shared";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { formatRelativeTime } from "@/lib/time";

const typeLabels: Record<FeedPost["type"], string> = {
  text: "Update",
  poll: "Poll",
  prompt: "Prompt",
  update: "Project drop",
};

type PostCardProps = {
  post: FeedPost;
};

export const PostCard = ({ post }: PostCardProps) => {
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
        <Tag tone="sun" className="ml-auto">
          {typeLabels[post.type]}
        </Tag>
      </div>
      <p className="text-base text-ink">{post.content}</p>
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <Tag key={tag} tone="default">
              {tag}
            </Tag>
          ))}
        </div>
      )}
    </Card>
  );
};
