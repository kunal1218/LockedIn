"use client";

import { useEffect, useState } from "react";
import type { FeedPost } from "@lockedin/shared";
import { useRouter } from "next/navigation";
import { Card } from "@/components/Card";
import { Tag } from "@/components/Tag";
import { useAuth } from "@/features/auth";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { PollCard } from "./PollCard";
import { PostCard } from "./PostCard";
import { PostComposerModal } from "./PostComposerModal";
import type { PostComposerPayload, PostComposerMode } from "./PostComposerModal";
import type { PollOption } from "@lockedin/shared";

const filterTags = ["All", "Build", "Help", "Chaos", "Cofounder"];
const sortOptions = [
  { id: "fresh", label: "Fresh" },
  { id: "top", label: "Top" },
] as const;

type SortOption = (typeof sortOptions)[number]["id"];

export const Feed = () => {
  const router = useRouter();
  const { user, token, openAuthModal } = useAuth();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>("fresh");
  const [composerMode, setComposerMode] = useState<PostComposerMode>("create");
  const [composerPost, setComposerPost] = useState<FeedPost | null>(null);
  const [isComposerOpen, setComposerOpen] = useState(false);
  const [pendingLikes, setPendingLikes] = useState<Set<string>>(new Set());
  const [pendingVotes, setPendingVotes] = useState<Set<string>>(new Set());
  const [pollSelections, setPollSelections] = useState<Record<string, string>>({});

  const orderPosts = (nextPosts: FeedPost[]) => {
    const sorted = [...nextPosts];
    if (sort === "top") {
      sorted.sort((a, b) => {
        if (b.likeCount !== a.likeCount) {
          return b.likeCount - a.likeCount;
        }
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
      return sorted;
    }

    sorted.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted;
  };

  useEffect(() => {
    let isActive = true;

    const loadFeed = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await apiGet<{ posts: FeedPost[] }>(
          `/feed?sort=${sort}`,
          token ?? undefined
        );
        if (isActive) {
          setPosts(response.posts);
        }
      } catch (loadError) {
        if (isActive) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load the feed."
          );
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadFeed();

    return () => {
      isActive = false;
    };
  }, [sort, token]);

  const openCreateComposer = () => {
    setComposerMode("create");
    setComposerPost(null);
    setComposerOpen(true);
  };

  const openEditComposer = (post: FeedPost) => {
    setComposerMode("edit");
    setComposerPost(post);
    setComposerOpen(true);
  };

  const handleSubmitPost = async (payload: PostComposerPayload) => {
    if (!token) {
      openAuthModal();
      throw new Error("Please sign in to post.");
    }

    if (composerMode === "create") {
      const response = await apiPost<{ post: FeedPost }>("/feed", payload, token);
      setPosts((prev) => orderPosts([response.post, ...prev]));
      return;
    }

    if (!composerPost) {
      throw new Error("Select a post to edit.");
    }

    const response = await apiPatch<{ post: FeedPost }>(
      `/feed/${composerPost.id}`,
      payload,
      token
    );
    setPosts((prev) =>
      orderPosts(
        prev.map((post) =>
          post.id === composerPost.id ? response.post : post
        )
      )
    );
    setComposerPost(response.post);
  };

  const handleDeletePost = async (post: FeedPost) => {
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
      setPosts((prev) => prev.filter((item) => item.id !== post.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete the post."
      );
    }
  };

  const handleToggleLike = async (post: FeedPost) => {
    if (!token) {
      openAuthModal();
      return;
    }

    if (pendingLikes.has(post.id)) {
      return;
    }

    setPendingLikes((prev) => {
      const next = new Set(prev);
      next.add(post.id);
      return next;
    });

    try {
      const response = await apiPost<{ likeCount: number; liked: boolean }>(
        `/feed/${post.id}/like`,
        {},
        token
      );
      setPosts((prev) =>
        orderPosts(
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  likeCount: response.likeCount,
                  likedByUser: response.liked,
                }
              : item
          )
        )
      );
    } catch (likeError) {
      setError(
        likeError instanceof Error
          ? likeError.message
          : "Unable to update the like."
      );
    } finally {
      setPendingLikes((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  const handleVote = async (post: FeedPost, optionId: string) => {
    if (!token) {
      openAuthModal();
      return;
    }

    if (pendingVotes.has(post.id)) {
      return;
    }

    setPendingVotes((prev) => {
      const next = new Set(prev);
      next.add(post.id);
      return next;
    });

    try {
      const response = await apiPost<{ options: PollOption[] }>(
        `/feed/${post.id}/poll/${optionId}/vote`,
        {},
        token
      );

      setPosts((prev) =>
        orderPosts(
          prev.map((item) =>
            item.id === post.id
              ? {
                  ...item,
                  pollOptions: response.options,
                }
              : item
          )
        )
      );
      setPollSelections((prev) => ({ ...prev, [post.id]: optionId }));
    } catch (voteError) {
      setError(
        voteError instanceof Error
          ? voteError.message
          : "Unable to submit your vote."
      );
    } finally {
      setPendingVotes((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  };

  const handleOpenPost = (target: FeedPost) => {
    if (!target.id) {
      setError("This post link is missing an ID. Refresh and try again.");
      return;
    }
    router.push(`/posts/${target.id}`);
  };

  const resolveUserVote = (post: FeedPost): string | null => {
    return pollSelections[post.id] ?? null;
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold">Global Feed</h2>
          <p className="text-sm text-muted">What your campus is up to right now.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Tag
            tone="default"
            className="h-7 px-3 py-0 text-[10px] uppercase tracking-[0.16em] text-muted"
          >
            Filter
          </Tag>
          {filterTags.map((tag) => (
            <Tag
              key={tag}
              tone={tag === "All" ? "accent" : "default"}
              className="h-7 px-3 py-0"
            >
              {tag}
            </Tag>
          ))}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full border border-card-border/70 bg-white/80 p-1">
            {sortOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`h-7 rounded-full px-3 text-xs font-semibold transition ${
                  sort === option.id
                    ? "bg-accent text-white shadow-[0_12px_24px_rgba(255,134,88,0.25)]"
                    : "text-ink/80 hover:bg-card-border/40"
                }`}
                onClick={() => setSort(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={openCreateComposer}
            aria-label="Create post"
            className="inline-flex h-7 items-center justify-center rounded-full border border-card-border/70 bg-white/80 px-3 text-lg font-semibold leading-none text-ink/80 transition hover:border-accent/50 hover:bg-accent/15 hover:text-accent"
          >
            <span className="relative top-[1px]">+</span>
          </button>
        </div>
      </div>
      {error && (
        <Card className="border border-accent/30 bg-accent/10 py-4">
          <p className="text-sm font-semibold text-accent">{error}</p>
        </Card>
      )}
      {isLoading ? (
        <Card className="py-10 text-center text-sm text-muted">
          Loading the feed...
        </Card>
      ) : posts.length === 0 ? (
        <Card className="py-10 text-center text-sm text-muted">
          No posts yet. Be the first to start the conversation.
        </Card>
      ) : (
        <div className="space-y-5">
          {posts.map((post) => {
            const isOwnPost = user?.id === post.author.id;
            const isLiking = pendingLikes.has(post.id);
            const isVoting = pendingVotes.has(post.id);
            
            return post.type === "poll" ? (
              <PollCard
                key={post.id}
                post={post}
                isOwnPost={isOwnPost}
                onOpen={handleOpenPost}
                onEdit={openEditComposer}
                onDelete={handleDeletePost}
                onLike={handleToggleLike}
                isLiking={isLiking}
                onVote={handleVote}
                isVoting={isVoting}
                selectedOptionId={resolveUserVote(post)}
              />
            ) : (
              <PostCard
                key={post.id}
                post={post}
                isOwnPost={isOwnPost}
                onOpen={handleOpenPost}
                onEdit={openEditComposer}
                onDelete={handleDeletePost}
                onLike={handleToggleLike}
                isLiking={isLiking}
              />
            );
          })}
        </div>
      )}
      <PostComposerModal
        isOpen={isComposerOpen}
        mode={composerMode}
        initialPost={composerPost}
        onClose={() => setComposerOpen(false)}
        onSubmit={handleSubmitPost}
      />
    </section>
  );
};
