"use client";

import type { KeyboardEvent, MouseEvent } from "react";
import type { FeedPost } from "@lockedin/shared";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import { deriveCollegeFromDomain, deriveCollegeFromEmail } from "@/lib/college";
import { formatRelativeTime } from "@/lib/time";

type PostCardProps = {
  post: FeedPost;
  isOwnPost?: boolean;
  onOpen?: (post: FeedPost) => void;
  onEdit?: (post: FeedPost) => void;
  onDelete?: (post: FeedPost) => void;
  onLike?: (post: FeedPost) => void;
  isLiking?: boolean;
};

export const PostCard = ({
  post,
  isOwnPost,
  onOpen,
  onEdit,
  onDelete,
  onLike,
  isLiking,
}: PostCardProps) => {
  const { user, isAuthenticated, openAuthModal } = useAuth();
  const router = useRouter();
  const isClickable = Boolean(onOpen);
  const likeCount = post.likeCount ?? 0;
  const fallbackCollege =
    user?.id === post.author.id && user.email
      ? deriveCollegeFromEmail(user.email)
      : null;
  const collegeLabel =
    post.author.collegeName ??
    deriveCollegeFromDomain(post.author.collegeDomain ?? "") ??
    fallbackCollege;
  const profileSlug =
    typeof post.author.handle === "string"
      ? post.author.handle.replace(/^@/, "").trim()
      : "";
  const profileIdentifier = profileSlug || post.author.id;

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-profile-link]")) {
      return;
    }
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

  const handleProfileClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal("signup");
      return;
    }

    if (user?.id === post.author.id) {
      router.push("/profile");
      return;
    }

    if (!profileIdentifier) {
      return;
    }
    router.push(`/profile/${encodeURIComponent(profileIdentifier)}`);
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
        <button
          type="button"
          onClick={handleProfileClick}
          className="rounded-full"
          aria-label={`View ${post.author.handle} profile`}
          data-profile-link
        >
          <Avatar name={post.author.name} />
        </button>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-ink">{post.author.handle}</p>
          </div>
          <p className="text-xs text-muted">
            {formatRelativeTime(post.createdAt)}
            {collegeLabel ? ` · ${collegeLabel}` : ""}
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
        </div>
      </div>
      <p className="text-base text-ink">{post.content}</p>
      {post.tags && post.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
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
