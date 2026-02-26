import { useCallback, useEffect, useMemo, useState } from "react";
import type { DailyChallenge, FeedComment, FeedPost, PollOption } from "@lockedin/shared";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  createFeedComment,
  createFeedPost,
  deleteFeedComment,
  deleteFeedPost,
  getDailyChallenge,
  getFeed,
  getFeedComments,
  toggleFeedCommentLike,
  toggleFeedLike,
  voteOnFeedPollOption,
} from "../../api/actions";
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

const fallbackChallenge: DailyChallenge = {
  id: "challenge-1",
  title: "Start a new micro-club in 24 hours",
  description: "Find 3 people. Pick a silly theme. Meet tonight. Post proof.",
  endsAt: new Date(Date.now() + 1000 * 60 * 60 * 6).toISOString(),
  participants: 86,
};

const pulseItems = [
  { label: "Cofounder search", count: 12, tone: "accent" as const },
  { label: "Basketball runs", count: 7, tone: "sun" as const },
  { label: "Late-night diner", count: 9, tone: "mint" as const },
  { label: "Design collab", count: 5, tone: "default" as const },
];

const chatMessages = [
  {
    id: "chat-1",
    handle: "@samirawins",
    initials: "S",
    message: "Daily challenge: pitching a campus snack club. Need ops + memes.",
    color: "#f3c58b",
    createdAt: new Date(Date.now() - 1000 * 60 * 6).toISOString(),
  },
  {
    id: "chat-2",
    handle: "@milesmoves",
    initials: "M",
    message: "Anyone want to co-work at the library in 30?",
    color: "#9ec6f5",
    createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
  },
  {
    id: "chat-3",
    handle: "@averycodes",
    initials: "A",
    message: "Trying to start a midnight pancake society. Yes this is serious.",
    color: "#9dddb9",
    createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
  },
];

const emptyCommentState = (): PostCommentsState => ({
  items: [],
  loading: false,
  loaded: false,
  draft: "",
  submitting: false,
  error: null,
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const parseChallenge = (value: unknown): DailyChallenge | null => {
  if (!isObject(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.title !== "string" ||
    typeof value.description !== "string" ||
    typeof value.endsAt !== "string" ||
    typeof value.participants !== "number"
  ) {
    return null;
  }

  return {
    id: value.id,
    title: value.title,
    description: value.description,
    endsAt: value.endsAt,
    participants: value.participants,
  };
};

const formatRelativeTime = (timestamp: string) => {
  const diff = Date.now() - Date.parse(timestamp);
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const getTimeLeft = (endsAt: string) => {
  const diff = Math.max(0, Date.parse(endsAt) - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return {
    hours,
    minutes,
    seconds,
  };
};

const pad2 = (value: number) => value.toString().padStart(2, "0");

export const FeedTab = ({ token, user, onAuthExpired }: SessionProps) => {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [draft, setDraft] = useState("");
  const [sort, setSort] = useState<"fresh" | "top">("fresh");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, PostCommentsState>>({});
  const [openCommentPosts, setOpenCommentPosts] = useState<Record<string, boolean>>({});
  const [pollVoteInFlight, setPollVoteInFlight] = useState<Set<string>>(new Set());

  const [challenge, setChallenge] = useState<DailyChallenge>(fallbackChallenge);
  const [challengeLoading, setChallengeLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(fallbackChallenge.endsAt));

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

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const nextPosts = await getFeed(sort, token);
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
  }, [onAuthExpired, sort, token]);

  const loadChallenge = useCallback(async () => {
    setChallengeLoading(true);

    try {
      const payload = await getDailyChallenge(token);
      const parsed = parseChallenge(payload);
      setChallenge(parsed ?? fallbackChallenge);
    } catch {
      setChallenge(fallbackChallenge);
    } finally {
      setChallengeLoading(false);
    }
  }, [token]);

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
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    void loadChallenge();
  }, [loadChallenge]);

  useEffect(() => {
    setTimeLeft(getTimeLeft(challenge.endsAt));
    const interval = setInterval(() => {
      setTimeLeft(getTimeLeft(challenge.endsAt));
    }, 1000);

    return () => clearInterval(interval);
  }, [challenge.endsAt]);

  const sortedPosts = useMemo(() => {
    if (sort === "fresh") {
      return posts;
    }

    const next = [...posts];
    next.sort((a, b) => {
      if ((b.likeCount ?? 0) !== (a.likeCount ?? 0)) {
        return (b.likeCount ?? 0) - (a.likeCount ?? 0);
      }
      return Date.parse(b.createdAt) - Date.parse(a.createdAt);
    });
    return next;
  }, [posts, sort]);

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

  const handlePollVote = async (postId: string, optionId: string) => {
    if (pollVoteInFlight.has(postId)) {
      return;
    }

    setPollVoteInFlight((prev) => new Set(prev).add(postId));

    try {
      const options = await voteOnFeedPollOption(postId, optionId, token);
      setPosts((prev) =>
        prev.map((post) =>
          post.id === postId
            ? {
                ...post,
                pollOptions: options,
              }
            : post
        )
      );
    } catch (voteError) {
      if (isAuthError(voteError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(voteError));
    } finally {
      setPollVoteInFlight((prev) => {
        const next = new Set(prev);
        next.delete(postId);
        return next;
      });
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
    <ScrollView
      style={homeStyles.page}
      contentContainerStyle={homeStyles.container}
      keyboardShouldPersistTaps="handled"
    >
      <View style={homeStyles.backgroundWrap}>
        <View style={homeStyles.orbA} />
        <View style={homeStyles.orbB} />
        <View style={homeStyles.orbC} />
      </View>

      <Card style={homeStyles.challengeCard}>
        <View style={homeStyles.challengeTopRow}>
          <View style={homeStyles.challengeBadge}>
            <Text style={homeStyles.challengeBadgeText}>Daily Challenge</Text>
          </View>
          <Text style={homeStyles.challengePeople}>
            {challenge.participants} people in today
          </Text>
        </View>

        <Text style={homeStyles.challengeTitle}>{challenge.title}</Text>
        <Text style={homeStyles.challengeDescription}>{challenge.description}</Text>

        <View style={homeStyles.countdownRow}>
          <View style={[homeStyles.countdownPill, homeStyles.countdownPillPrimary]}>
            <Text style={homeStyles.countdownValue}>{pad2(timeLeft.hours)}</Text>
            <Text style={homeStyles.countdownLabel}>hrs</Text>
          </View>
          <View style={[homeStyles.countdownPill, homeStyles.countdownPillSecondary]}>
            <Text style={homeStyles.countdownValue}>{pad2(timeLeft.minutes)}</Text>
            <Text style={homeStyles.countdownLabel}>min</Text>
          </View>
          <View style={[homeStyles.countdownPill, homeStyles.countdownPillTertiary]}>
            <Text style={homeStyles.countdownValue}>{pad2(timeLeft.seconds)}</Text>
            <Text style={homeStyles.countdownLabel}>sec</Text>
          </View>
        </View>

        <View style={homeStyles.challengeActionRow}>
          <Pressable
            style={homeStyles.primaryAction}
            onPress={() => {
              Alert.alert("Daily challenge", "Challenge submissions on mobile are coming next.");
            }}
          >
            <Text style={homeStyles.primaryActionLabel}>Join the chaos</Text>
          </Pressable>
          <Pressable
            style={homeStyles.secondaryAction}
            onPress={() => {
              void loadChallenge();
            }}
          >
            <Text style={homeStyles.secondaryActionLabel}>
              {challengeLoading ? "Refreshing..." : "Refresh challenge"}
            </Text>
          </Pressable>
        </View>
      </Card>

      <View style={homeStyles.feedHeaderRow}>
        <View>
          <Text style={homeStyles.sectionTitle}>Global Feed</Text>
          <Text style={homeStyles.sectionSubtitle}>What your campus is up to right now.</Text>
        </View>
        <View style={homeStyles.sortRow}>
          {(["fresh", "top"] as const).map((option) => (
            <Pressable
              key={option}
              style={[homeStyles.sortPill, sort === option && homeStyles.sortPillActive]}
              onPress={() => setSort(option)}
            >
              <Text style={[homeStyles.sortPillLabel, sort === option && homeStyles.sortPillLabelActive]}>
                {option === "fresh" ? "Fresh" : "Top"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Card style={homeStyles.composerCard}>
        <TextInput
          style={homeStyles.composerInput}
          value={draft}
          onChangeText={setDraft}
          placeholder="Share a quick update, invite collaborators, or start a poll later..."
          multiline
        />
        <Pressable
          style={[homeStyles.primaryAction, submitting && homeStyles.actionDisabled]}
          onPress={() => {
            void submitPost();
          }}
          disabled={submitting}
        >
          <Text style={homeStyles.primaryActionLabel}>{submitting ? "Posting..." : "Post to feed"}</Text>
        </Pressable>
      </Card>

      {error ? (
        <Card style={homeStyles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </Card>
      ) : null}

      {loading ? <ActivityIndicator color="#2563eb" /> : null}

      {!loading && sortedPosts.length === 0 ? (
        <Card>
          <Text style={styles.emptyText}>No posts yet. Be the first to start the conversation.</Text>
        </Card>
      ) : null}

      {sortedPosts.map((post) => {
        const isOwn = post.author.id === user.id;
        const commentsState = commentsByPost[post.id] ?? emptyCommentState();
        const commentsOpen = Boolean(openCommentPosts[post.id]);
        const commentCount = post.commentCount ?? commentsState.items.length;

        return (
          <Card key={post.id} style={homeStyles.postCard}>
            <View style={homeStyles.postHeader}>
              <View>
                <Text style={homeStyles.postHandle}>{post.author.handle}</Text>
                <Text style={homeStyles.postMeta}>{formatRelativeTime(post.createdAt)}</Text>
              </View>
              <Text style={homeStyles.postType}>{post.type.toUpperCase()}</Text>
            </View>

            <Text style={homeStyles.postBody}>{post.content}</Text>

            {post.tags?.length ? (
              <View style={homeStyles.tagRow}>
                {post.tags.map((tag) => (
                  <View key={tag} style={homeStyles.tagPill}>
                    <Text style={homeStyles.tagLabel}>#{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {post.type === "poll" && post.pollOptions?.length ? (
              <View style={homeStyles.pollWrap}>
                <Text style={homeStyles.pollTitle}>Poll options</Text>
                {post.pollOptions.map((option: PollOption) => (
                  <Pressable
                    key={option.id}
                    style={homeStyles.pollOption}
                    disabled={pollVoteInFlight.has(post.id)}
                    onPress={() => {
                      void handlePollVote(post.id, option.id);
                    }}
                  >
                    <Text style={homeStyles.pollOptionLabel}>{option.label}</Text>
                    <Text style={homeStyles.pollOptionVotes}>{option.votes} votes</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={homeStyles.postActionRow}>
              <Pressable
                style={[homeStyles.iconAction, post.likedByUser && homeStyles.iconActionActive]}
                onPress={() => {
                  void handleLike(post.id);
                }}
              >
                <Text style={[homeStyles.iconActionLabel, post.likedByUser && homeStyles.iconActionLabelActive]}>
                  {post.likedByUser ? "♥" : "♡"} {post.likeCount}
                </Text>
              </Pressable>
              <Pressable
                style={homeStyles.iconAction}
                onPress={() => {
                  void toggleComments(post.id);
                }}
              >
                <Text style={homeStyles.iconActionLabel}>
                  {commentsOpen ? "Hide" : "Comments"} {commentCount}
                </Text>
              </Pressable>
              {(isOwn || user.isAdmin) && (
                <Pressable
                  style={[homeStyles.iconAction, homeStyles.dangerAction]}
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
                >
                  <Text style={homeStyles.dangerActionLabel}>Delete</Text>
                </Pressable>
              )}
            </View>

            {commentsOpen ? (
              <View style={styles.commentsContainer}>
                <Text style={styles.cardTitle}>Comments</Text>

                {commentsState.loading ? <ActivityIndicator color="#2563eb" /> : null}
                {commentsState.error ? <Text style={styles.errorText}>{commentsState.error}</Text> : null}

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
                        <Pressable
                          style={homeStyles.smallAction}
                          onPress={() => {
                            void handleCommentLike(post.id, comment.id);
                          }}
                        >
                          <Text style={homeStyles.smallActionLabel}>
                            {comment.likedByUser ? "♥" : "♡"} {comment.likeCount}
                          </Text>
                        </Pressable>
                        {canDelete ? (
                          <Pressable
                            style={[homeStyles.smallAction, homeStyles.smallActionDanger]}
                            onPress={() => {
                              void handleCommentDelete(post.id, comment.id);
                            }}
                          >
                            <Text style={homeStyles.smallActionDangerLabel}>Delete</Text>
                          </Pressable>
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
                  <Pressable
                    style={[homeStyles.smallPrimaryAction, commentsState.submitting && homeStyles.actionDisabled]}
                    onPress={() => {
                      void submitComment(post.id);
                    }}
                    disabled={commentsState.submitting}
                  >
                    <Text style={homeStyles.smallPrimaryActionLabel}>
                      {commentsState.submitting ? "Sending..." : "Send"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </Card>
        );
      })}

      <Card style={homeStyles.sideCard}>
        <View style={homeStyles.sideHeaderRow}>
          <View style={homeStyles.uniChatTag}>
            <Text style={homeStyles.uniChatTagText}>Uni Chat</Text>
          </View>
          <Text style={homeStyles.onlineCount}>{chatMessages.length} online</Text>
        </View>

        <Text style={homeStyles.sideSubtitle}>Global chat. Keep it light, invite people in.</Text>

        {chatMessages.map((message) => (
          <View key={message.id} style={homeStyles.chatRow}>
            <View style={[homeStyles.chatAvatar, { backgroundColor: message.color }]}>
              <Text style={homeStyles.chatAvatarText}>{message.initials}</Text>
            </View>
            <View style={homeStyles.chatMessageWrap}>
              <Text style={homeStyles.chatMeta}>
                {message.handle} • {formatRelativeTime(message.createdAt)}
              </Text>
              <Text style={homeStyles.chatBody}>{message.message}</Text>
            </View>
          </View>
        ))}

        <View style={homeStyles.chatInputBox}>
          <Text style={homeStyles.chatInputLabel}>Say something</Text>
          <TextInput
            style={homeStyles.chatInput}
            placeholder="Drop a plan, a question, or a vibe..."
          />
          <Text style={homeStyles.chatInputHint}>TODO: wire real-time chat</Text>
        </View>
      </Card>

      <Card style={homeStyles.sideCard}>
        <Text style={homeStyles.sectionTitle}>Campus Pulse</Text>
        <Text style={homeStyles.sideSubtitle}>What is popping in the last hour.</Text>

        {pulseItems.map((item) => (
          <View key={item.label} style={homeStyles.pulseRow}>
            <Text style={homeStyles.pulseLabel}>{item.label}</Text>
            <View
              style={[
                homeStyles.pulseTag,
                item.tone === "accent"
                  ? homeStyles.pulseTagAccent
                  : item.tone === "mint"
                  ? homeStyles.pulseTagMint
                  : item.tone === "sun"
                  ? homeStyles.pulseTagSun
                  : homeStyles.pulseTagDefault,
              ]}
            >
              <Text style={homeStyles.pulseTagText}>{item.count} posts</Text>
            </View>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
};

const homeStyles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f7f8fb",
  },
  container: {
    padding: 14,
    gap: 12,
    paddingBottom: 36,
  },
  backgroundWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260,
    zIndex: -1,
  },
  orbA: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    top: -80,
    left: -90,
    backgroundColor: "rgba(255, 133, 87, 0.22)",
  },
  orbB: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    top: 25,
    right: -100,
    backgroundColor: "rgba(124, 117, 244, 0.12)",
  },
  orbC: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    top: 180,
    left: 160,
    backgroundColor: "rgba(111, 198, 159, 0.12)",
  },
  challengeCard: {
    borderColor: "#f6c6ae",
    backgroundColor: "#fff8f5",
    gap: 12,
  },
  challengeTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  challengeBadge: {
    borderRadius: 999,
    backgroundColor: "rgba(255, 133, 87, 0.16)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  challengeBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#cf5f35",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  challengePeople: {
    fontSize: 12,
    fontWeight: "700",
    color: "#8c5d4a",
  },
  challengeTitle: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#1b1a17",
  },
  challengeDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6b7280",
  },
  countdownRow: {
    flexDirection: "row",
    gap: 8,
  },
  countdownPill: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  countdownPillPrimary: {
    backgroundColor: "rgba(255, 133, 87, 0.16)",
  },
  countdownPillSecondary: {
    backgroundColor: "rgba(111, 198, 159, 0.16)",
  },
  countdownPillTertiary: {
    backgroundColor: "rgba(124, 117, 244, 0.14)",
  },
  countdownValue: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1f2937",
  },
  countdownLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  challengeActionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  primaryAction: {
    flex: 1,
    borderRadius: 999,
    backgroundColor: "#ff8557",
    paddingVertical: 11,
    alignItems: "center",
    shadowColor: "#ff8557",
    shadowOpacity: 0.26,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  primaryActionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#ffffff",
  },
  secondaryAction: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#ead6cc",
    backgroundColor: "#fff",
    paddingVertical: 11,
    alignItems: "center",
  },
  secondaryActionLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#5c6470",
  },
  actionDisabled: {
    opacity: 0.65,
  },
  feedHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1f2937",
  },
  sectionSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: "#6b7280",
  },
  sortRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    padding: 2,
    backgroundColor: "#fff",
  },
  sortPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  sortPillActive: {
    backgroundColor: "#ff8557",
  },
  sortPillLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
  },
  sortPillLabelActive: {
    color: "#fff",
  },
  composerCard: {
    backgroundColor: "#ffffff",
  },
  composerInput: {
    minHeight: 92,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 16,
    backgroundColor: "#fbfbfd",
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    lineHeight: 20,
    color: "#111827",
    textAlignVertical: "top",
  },
  errorCard: {
    borderColor: "#fecaca",
    backgroundColor: "#fef2f2",
  },
  postCard: {
    backgroundColor: "#fff",
    borderColor: "#e8eaf0",
  },
  postHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8,
  },
  postHandle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
  },
  postMeta: {
    marginTop: 2,
    fontSize: 11,
    color: "#6b7280",
  },
  postType: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9ca3af",
    letterSpacing: 0.7,
  },
  postBody: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    color: "#1f2937",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagPill: {
    borderRadius: 999,
    backgroundColor: "#f3f4f6",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  tagLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4b5563",
  },
  pollWrap: {
    gap: 8,
    marginTop: 2,
  },
  pollTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  pollOption: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    backgroundColor: "#f9fafb",
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  pollOptionLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: "#1f2937",
  },
  pollOptionVotes: {
    fontSize: 12,
    color: "#6b7280",
  },
  postActionRow: {
    marginTop: 2,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  iconAction: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  iconActionActive: {
    borderColor: "#ffccb9",
    backgroundColor: "#fff3ef",
  },
  iconActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#4b5563",
  },
  iconActionLabelActive: {
    color: "#cb5a32",
  },
  dangerAction: {
    borderColor: "#fecaca",
    backgroundColor: "#fff5f5",
  },
  dangerActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#b91c1c",
  },
  smallAction: {
    borderWidth: 1,
    borderColor: "#dbe2f0",
    backgroundColor: "#f8fafc",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  smallActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#475569",
  },
  smallActionDanger: {
    borderColor: "#fecaca",
    backgroundColor: "#fff1f2",
  },
  smallActionDangerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#be123c",
  },
  smallPrimaryAction: {
    borderRadius: 999,
    backgroundColor: "#2563eb",
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: "center",
  },
  smallPrimaryActionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  sideCard: {
    backgroundColor: "#fff",
  },
  sideHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  uniChatTag: {
    borderRadius: 999,
    backgroundColor: "rgba(111, 198, 159, 0.18)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  uniChatTagText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#267b59",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  onlineCount: {
    fontSize: 12,
    fontWeight: "700",
    color: "#267b59",
  },
  sideSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
    marginBottom: 2,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
  },
  chatAvatar: {
    width: 30,
    height: 30,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  chatAvatarText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#1f2937",
  },
  chatMessageWrap: {
    flex: 1,
    gap: 3,
  },
  chatMeta: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
  },
  chatBody: {
    fontSize: 13,
    lineHeight: 18,
    color: "#1f2937",
  },
  chatInputBox: {
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 14,
    backgroundColor: "#fbfbfd",
    paddingHorizontal: 11,
    paddingVertical: 10,
    gap: 6,
  },
  chatInputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
  },
  chatInput: {
    fontSize: 13,
    color: "#111827",
    paddingVertical: 0,
  },
  chatInputHint: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  pulseRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 6,
  },
  pulseLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1f2937",
  },
  pulseTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pulseTagDefault: {
    backgroundColor: "#eef2f7",
  },
  pulseTagAccent: {
    backgroundColor: "rgba(255, 133, 87, 0.17)",
  },
  pulseTagMint: {
    backgroundColor: "rgba(111, 198, 159, 0.18)",
  },
  pulseTagSun: {
    backgroundColor: "rgba(232, 186, 98, 0.24)",
  },
  pulseTagText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
  },
});
