"use client";

import type { KeyboardEvent, MouseEvent } from "react";
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
  isOwnPost?: boolean;
  onOpen?: (post: FeedPost) => void;
  onEdit?: (post: FeedPost) => void;
  onDelete?: (post: FeedPost) => void;
  onLike?: (post: FeedPost) => void;
  isLiking?: boolean;
};

export const PollCard = ({
  post,
  isOwnPost,
  onOpen,
  onEdit,
  onDelete,
  onLike,
  isLiking,
}: PollCardProps) => {
  const maxVotes = getMaxVotes(post) || 1;
  const isClickable = Boolean(onOpen);
  const likeCount = post.likeCount ?? 0;

  const handleCardClick = () => {
    onOpen?.(post);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!isClickable) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen?.(post);
    }
  };

  const handleActionClick =
    (action?: (post: FeedPost) => void) => (event: MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      action?.(post);
    };

  return (
    <Card
      className={`space-y-4 ${
        isClickable
          ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-[0_24px_50px_rgba(30,26,22,0.12)]"
          : ""
      }`}
      onClick={isClickable ? handleCardClick : undefined}
      onKeyDown={isClickable ? handleKeyDown : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="flex items-center gap-3">
        <Avatar name={post.author.name} />
        <div>
          <p className="text-sm font-semibold text-ink">{post.author.name}</p>
          <p className="text-xs text-muted">
            {post.author.handle} · {formatRelativeTime(post.createdAt)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isOwnPost && onEdit && (
            <button
              type="button"
              className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
              onClick={handleActionClick(onEdit)}
            >
              Edit
            </button>
          )}
          {isOwnPost && onDelete && (
            <button
              type="button"
              className="rounded-full border border-card-border/70 px-3 py-1 text-xs font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
              onClick={handleActionClick(onDelete)}
            >
              Delete
            </button>
          )}
          <Tag tone="mint">Poll</Tag>
        </div>
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
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            post.likedByUser
              ? "border-accent/40 bg-accent/15 text-accent"
              : "border-card-border/70 bg-white/80 text-ink/80 hover:border-accent/40 hover:text-ink"
          }`}
          onClick={handleActionClick(onLike)}
          disabled={!onLike || isLiking}
          aria-pressed={post.likedByUser}
        >
          Like {likeCount}
        </button>
        {post.tags?.map((tag) => (
          <Tag key={tag} tone="default">
            {tag}
          </Tag>
        ))}
      </div>
    </Card>
  );
};
