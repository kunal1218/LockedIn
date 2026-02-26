import { useCallback, useEffect, useState } from "react";
import type { FeedComment, FeedPost } from "@lockedin/shared";
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, View } from "react-native";
import {
  createFeedComment,
  createFeedPost,
  deleteFeedComment,
  deleteFeedPost,
  getFeed,
  getFeedComments,
  toggleFeedCommentLike,
  toggleFeedLike,
} from "../../api/actions";
import { ActionButton } from "../../components/ActionButton";
import { Card } from "../../components/Card";
import { formatError, isAuthError } from "../../lib/errors";
import { formatDateTime } from "../../lib/time";
import type { SessionProps } from "../../types/session";
import { styles } from "../../styles/ui";

type PostCommentsState = {
  items: FeedComment[];
  loading: boolean;
  loaded: boolean;
  draft: string;
  submitting: boolean;
  error: string | null;
};

const emptyCommentState = (): PostCommentsState => ({
  items: [],
  loading: false,
  loaded: false,
  draft: "",
  submitting: false,
  error: null,
});

export const FeedTab = ({ token, user, onAuthExpired }: SessionProps) => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentsState>>({});
  const [openCommentPosts, setOpenCommentPosts] = useState<Record<string, boolean>>({});

  const updateCommentState = (
    postId: string,
    updater: (current: PostCommentsState) => PostCommentsState
  ) => {
    setCommentsByPost((prev) => {
      const current = prev[postId] ?? emptyCommentState();
      return {
        ...prev,
        [postId]: updater(current),
      };
    });
  };

  const bumpCommentCount = (postId: string, delta: number) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId
          ? {
              ...post,
              commentCount: Math.max(0, (post.commentCount ?? 0) + delta),
            }
          : post
      )
    );
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextPosts = await getFeed("fresh", token);
      setPosts(nextPosts);
    } catch (loadError) {
      if (isAuthError(loadError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(loadError));
    } finally {
      setLoading(false);
    }
  }, [onAuthExpired, token]);

  const loadComments = useCallback(
    async (postId: string) => {
      updateCommentState(postId, (current) => ({
        ...current,
        loading: true,
        error: null,
      }));

      try {
        const comments = await getFeedComments(postId, token);
        updateCommentState(postId, (current) => ({
          ...current,
          items: comments,
          loaded: true,
          loading: false,
          error: null,
        }));
      } catch (loadError) {
        if (isAuthError(loadError)) {
          onAuthExpired();
          return;
        }

        updateCommentState(postId, (current) => ({
          ...current,
          loading: false,
          error: formatError(loadError),
        }));
      }
    },
    [onAuthExpired, token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  const submitPost = async () => {
    const content = draft.trim();
    if (!content) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const created = await createFeedPost(
        {
          type: "text",
          content,
          tags: [],
        },
        token
      );
      setPosts((prev) => [created, ...prev]);
      setDraft("");
    } catch (submitError) {
      if (isAuthError(submitError)) {
        onAuthExpired();
        return;
      }

      setError(formatError(submitError));
    } finally {
      setSubmitting(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const response = await toggleFeedLike(postId, token);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                likeCount: response.likeCount,
                likedByUser: response.liked,
              }
            : post
        )
      );
    } catch (likeError) {
      if (isAuthError(likeError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(likeError));
    }
  };

  const handleDelete = async (postId: string) => {
    try {
      await deleteFeedPost(postId, token);
      setPosts((prev) => prev.filter((post) => post.id !== postId));
      setCommentsByPost((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
      setOpenCommentPosts((prev) => {
        const next = { ...prev };
        delete next[postId];
        return next;
      });
    } catch (deleteError) {
      if (isAuthError(deleteError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(deleteError));
    }
  };

  const toggleComments = async (postId: string) => {
    const currentlyOpen = Boolean(openCommentPosts[postId]);
    setOpenCommentPosts((prev) => ({
      ...prev,
      [postId]: !currentlyOpen,
    }));

    if (currentlyOpen) {
      return;
    }

    const commentsState = commentsByPost[postId] ?? emptyCommentState();
    if (!commentsState.loaded && !commentsState.loading) {
      await loadComments(postId);
    }
  };

  const submitComment = async (postId: string) => {
    const draftValue = (commentsByPost[postId]?.draft ?? "").trim();
    if (!draftValue) {
      return;
    }

    updateCommentState(postId, (current) => ({
      ...current,
      submitting: true,
      error: null,
    }));

    try {
      const comment = await createFeedComment(postId, draftValue, token);
      updateCommentState(postId, (current) => ({
        ...current,
        submitting: false,
        draft: "",
        loaded: true,
        items: [comment, ...current.items],
      }));
      bumpCommentCount(postId, 1);
    } catch (submitError) {
      if (isAuthError(submitError)) {
        onAuthExpired();
        return;
      }

      updateCommentState(postId, (current) => ({
        ...current,
        submitting: false,
        error: formatError(submitError),
      }));
    }
  };

  const handleCommentLike = async (postId: string, commentId: string) => {
    try {
      const response = await toggleFeedCommentLike(commentId, token);
      updateCommentState(postId, (current) => ({
        ...current,
        items: current.items.map((comment) =>
          comment.id === commentId
            ? {
                ...comment,
                likeCount: response.likeCount,
                likedByUser: response.liked,
              }
            : comment
        ),
      }));
    } catch (likeError) {
      if (isAuthError(likeError)) {
        onAuthExpired();
        return;
      }

      updateCommentState(postId, (current) => ({
        ...current,
        error: formatError(likeError),
      }));
    }
  };

  const handleCommentDelete = async (postId: string, commentId: string) => {
    try {
      await deleteFeedComment(commentId, token);
      updateCommentState(postId, (current) => ({
        ...current,
        items: current.items.filter((comment) => comment.id !== commentId),
      }));
      bumpCommentCount(postId, -1);
    } catch (deleteError) {
      if (isAuthError(deleteError)) {
        onAuthExpired();
        return;
      }

      updateCommentState(postId, (current) => ({
        ...current,
        error: formatError(deleteError),
      }));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.sectionTitle}>Post to Feed</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={draft}
          onChangeText={setDraft}
          placeholder="Share something with campus"
          multiline
        />
        <ActionButton
          label={submitting ? "Posting..." : "Post"}
          onPress={() => {
            void submitPost();
          }}
          disabled={submitting}
        />
      </Card>

      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Latest Posts</Text>
        <ActionButton
          label={loading ? "Refreshing..." : "Refresh"}
          onPress={() => {
            void load();
          }}
          disabled={loading}
          tone="muted"
        />
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      {loading ? <ActivityIndicator color="#2563eb" /> : null}

      {posts.map((post) => {
        const isOwn = post.author.id === user.id;
        const commentsState = commentsByPost[post.id] ?? emptyCommentState();
        const commentsOpen = Boolean(openCommentPosts[post.id]);
        const commentCount = post.commentCount ?? commentsState.items.length;

        return (
          <Card key={post.id}>
            <View style={styles.rowBetween}>
              <Text style={styles.cardTitle}>{post.author.handle}</Text>
              <Text style={styles.timestamp}>{formatDateTime(post.createdAt)}</Text>
            </View>
            <Text style={styles.cardBody}>{post.content}</Text>
            <View style={styles.inlineActions}>
              <ActionButton
                label={
                  post.likedByUser
                    ? `Unlike (${post.likeCount})`
                    : `Like (${post.likeCount})`
                }
                onPress={() => {
                  void handleLike(post.id);
                }}
                tone="muted"
              />
              <ActionButton
                label={commentsOpen ? `Hide comments (${commentCount})` : `Comments (${commentCount})`}
                onPress={() => {
                  void toggleComments(post.id);
                }}
                tone="muted"
              />
              {isOwn || user.isAdmin ? (
                <ActionButton
                  label="Delete"
                  tone="danger"
                  onPress={() => {
                    Alert.alert("Delete post", "This cannot be undone.", [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          void handleDelete(post.id);
                        },
                      },
                    ]);
                  }}
                />
              ) : null}
            </View>

            {commentsOpen ? (
              <View style={styles.commentsContainer}>
                <Text style={styles.cardTitle}>Comments</Text>

                {commentsState.loading ? <ActivityIndicator color="#2563eb" /> : null}
                {commentsState.error ? (
                  <Text style={styles.errorText}>{commentsState.error}</Text>
                ) : null}

                {commentsState.items.map((comment) => {
                  const canDelete = comment.author.id === user.id || Boolean(user.isAdmin);

                  return (
                    <View key={comment.id} style={styles.commentCard}>
                      <View style={styles.rowBetween}>
                        <Text style={styles.cardTitle}>{comment.author.handle}</Text>
                        <Text style={styles.timestamp}>{formatDateTime(comment.createdAt)}</Text>
                      </View>
                      <Text style={styles.commentText}>{comment.content}</Text>
                      <View style={styles.inlineActions}>
                        <ActionButton
                          label={
                            comment.likedByUser
                              ? `Unlike (${comment.likeCount})`
                              : `Like (${comment.likeCount})`
                          }
                          tone="muted"
                          onPress={() => {
                            void handleCommentLike(post.id, comment.id);
                          }}
                        />
                        {canDelete ? (
                          <ActionButton
                            label="Delete"
                            tone="danger"
                            onPress={() => {
                              void handleCommentDelete(post.id, comment.id);
                            }}
                          />
                        ) : null}
                      </View>
                    </View>
                  );
                })}

                {!commentsState.loading && commentsState.items.length === 0 ? (
                  <Text style={styles.emptyText}>No comments yet.</Text>
                ) : null}

                <View style={styles.composeRow}>
                  <TextInput
                    style={[styles.input, styles.compactInput]}
                    value={commentsState.draft}
                    onChangeText={(value) => {
                      updateCommentState(post.id, (current) => ({
                        ...current,
                        draft: value,
                      }));
                    }}
                    placeholder="Write a comment"
                    multiline
                  />
                  <ActionButton
                    label={commentsState.submitting ? "Sending..." : "Send comment"}
                    onPress={() => {
                      void submitComment(post.id);
                    }}
                    disabled={commentsState.submitting}
                  />
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}

      {!loading && posts.length === 0 ? <Text style={styles.emptyText}>No posts yet.</Text> : null}
    </ScrollView>
  );
};
