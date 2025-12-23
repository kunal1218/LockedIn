"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { FeedComment, FeedPost } from "@lockedin/shared";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { formatRelativeTime } from "@/lib/time";
import { PollCard } from "./PollCard";
import { PostCard } from "./PostCard";
import { PostComposerModal } from "./PostComposerModal";
import type { PostComposerPayload } from "./PostComposerModal";

const inputClasses =
  "w-full rounded-2xl border border-card-border/80 bg-white/80 px-4 py-3 text-sm text-ink placeholder:text-muted/60 focus:border-accent/60 focus:outline-none focus:ring-2 focus:ring-accent/20";

type PostDetailProps = {
  postId: string;
};

export const PostDetail = ({ postId }: PostDetailProps) => {
  const router = useRouter();
  const { user, token, openAuthModal } = useAuth();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [isLiking, setIsLiking] = useState(false);
  const commentsRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    let isActive = true;

    const loadPost = async () => {
      setIsLoading(true);
      setError(null);
      setPost(null);
      setComments([]);

      if (!postId) {
        setError("This post link is missing an ID.");
        setIsLoading(false);
        return;
      }
      try {
        const [postResponse, commentResponse] = await Promise.all([
          apiGet<{ post: FeedPost }>(`/feed/${postId}`, token ?? undefined),
          apiGet<{ comments: FeedComment[] }>(
            `/feed/${postId}/comments`,
            token ?? undefined
          ),
        ]);

        if (!isActive) {
          return;
        }

        setPost(postResponse.post);
        setComments(commentResponse.comments);
      } catch (loadError) {
        if (!isActive) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load this post."
        );
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadPost();

    return () => {
      isActive = false;
    };
  }, [postId, token]);

  const handleDeletePost = async (_post?: FeedPost) => {
    if (!post) {
      return;
    }

    if (!token) {
      openAuthModal();
      return;
    }

    const confirmed = window.confirm("Delete this post? This can't be undone.");
    if (!confirmed) {
      return;
    }

    try {
      await apiDelete(`/feed/${post.id}`, token);
      router.push("/");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the post."
      );
    }
  };

  const handleToggleLike = async (_post?: FeedPost) => {
    if (!post) {
      return;
    }

    if (!token) {
      openAuthModal();
      return;
    }

    if (isLiking) {
      return;
    }

    setIsLiking(true);
    try {
      const response = await apiPost<{ likeCount: number; liked: boolean }>(
        `/feed/${post.id}/like`,
        {},
        token
      );
      setPost((prev) =>
        prev
          ? {
              ...prev,
              likeCount: response.likeCount,
              likedByUser: response.liked,
            }
          : prev
      );
    } catch (likeError) {
      setError(
        likeError instanceof Error
          ? likeError.message
          : "Unable to update the like."
      );
    } finally {
      setIsLiking(false);
    }
  };

  const handleSubmitEdit = async (payload: PostComposerPayload) => {
    if (!post) {
      throw new Error("Post not available.");
    }

    if (!token) {
      openAuthModal();
      throw new Error("Please sign in to edit.");
    }

    const response = await apiPatch<{ post: FeedPost }>(
      `/feed/${post.id}`,
      payload,
      token
    );
    setPost(response.post);
  };

  const handleSubmitComment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCommentError(null);

    if (!token) {
      openAuthModal();
      return;
    }

    const trimmed = commentBody.trim();
    if (!trimmed) {
      setCommentError("Write a comment before posting.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await apiPost<{ comment: FeedComment }>(
        `/feed/${postId}/comments`,
        { content: trimmed },
        token
      );
      setComments((prev) => [...prev, response.comment]);
      setCommentBody("");
    } catch (submitError) {
      setCommentError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to post your comment."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const isOwnPost = Boolean(post && user?.id === post.author.id);
  const handleOpenEdit = (_post?: FeedPost) => {
    setComposerOpen(true);
  };

  const handleOpenComment = (_post?: FeedPost) => {
    commentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        commentInputRef.current?.focus();
      }, 150);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-2">
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-semibold">Post detail</h1>
            <p className="text-sm text-muted">
              Dive into the full conversation and leave your reply.
            </p>
          </div>
          <Button
            variant="outline"
            requiresAuth={false}
            onClick={() => router.push("/")}
          >
            Back to feed
          </Button>
        </div>

        {error && (
          <Card className="border border-accent/30 bg-accent/10 py-4">
            <p className="text-sm font-semibold text-accent">{error}</p>
          </Card>
        )}

        {isLoading ? (
          <Card className="py-10 text-center text-sm text-muted">
            Loading post...
          </Card>
        ) : post ? (
          post.type === "poll" ? (
            <PollCard
              post={post}
              isOwnPost={isOwnPost}
              onEdit={handleOpenEdit}
              onDelete={handleDeletePost}
              onLike={handleToggleLike}
              onComment={handleOpenComment}
              isLiking={isLiking}
            />
          ) : (
            <PostCard
              post={post}
              isOwnPost={isOwnPost}
              onEdit={handleOpenEdit}
              onDelete={handleDeletePost}
              onLike={handleToggleLike}
              onComment={handleOpenComment}
              isLiking={isLiking}
            />
          )
        ) : (
          <Card className="py-10 text-center text-sm text-muted">
            Post not found.
          </Card>
        )}

        {post && (
          <div ref={commentsRef}>
            <Card className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Comments
                  </p>
                  <h2 className="mt-2 font-display text-xl font-semibold">
                    {comments.length} replies
                  </h2>
                </div>
              </div>

              <form className="space-y-3" onSubmit={handleSubmitComment}>
                <textarea
                  ref={commentInputRef}
                  className={`${inputClasses} min-h-[120px]`}
                  value={commentBody}
                  onChange={(event) => setCommentBody(event.target.value)}
                  placeholder="Add your take, share a tip, or respond with a plan."
                />
                {commentError && (
                  <p className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
                    {commentError}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Posting..." : "Post comment"}
                  </Button>
                </div>
              </form>

              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-sm text-muted">
                    No comments yet. Start the conversation.
                  </p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="flex items-start gap-3">
                      <Avatar name={comment.author.name} size={32} />
                      <div>
                        <div className="flex items-center gap-2 text-xs text-muted">
                          <span className="font-semibold text-ink">
                            {comment.author.handle}
                          </span>
                          <span>{formatRelativeTime(comment.createdAt)}</span>
                        </div>
                        <p className="text-sm text-ink/90">{comment.content}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>

      <PostComposerModal
        isOpen={isComposerOpen}
        mode="edit"
        initialPost={post}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleSubmitEdit}
      />
    </div>
  );
};
