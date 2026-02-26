import { useCallback, useEffect, useState } from "react";
import type { RequestCard } from "@lockedin/shared";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import {
  createRequest,
  deleteRequestById,
  getRequests,
  helpWithRequest,
  toggleRequestLike,
  unhelpWithRequest,
} from "../../api/actions";
import { ActionButton } from "../../components/ActionButton";
import { Card } from "../../components/Card";
import { formatError, isAuthError } from "../../lib/errors";
import type { SessionProps } from "../../types/session";
import { styles } from "../../styles/ui";

export const RequestsTab = ({ token, user, onAuthExpired }: SessionProps) => {
  const [requests, setRequests] = useState<RequestCard[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [isRemote, setIsRemote] = useState(false);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getRequests(token, { order: "newest" });
      setRequests(response.requests);
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

  useEffect(() => {
    void load();
  }, [load]);

  const submitRequest = async () => {
    const normalizedTitle = title.trim();
    const normalizedDescription = description.trim();

    if (!normalizedTitle || !normalizedDescription) {
      setError("Title and description are required.");
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const created = await createRequest(
        {
          title: normalizedTitle,
          description: normalizedDescription,
          city: city.trim() || undefined,
          isRemote,
          location: isRemote ? "Remote" : city.trim() || "Unknown",
          urgency: "medium",
          tags: [],
        },
        token
      );
      setRequests((prev) => [created, ...prev]);
      setTitle("");
      setDescription("");
      setCity("");
      setIsRemote(false);
    } catch (submitError) {
      if (isAuthError(submitError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(submitError));
    } finally {
      setPosting(false);
    }
  };

  const handleLike = async (requestId: string) => {
    try {
      const response = await toggleRequestLike(requestId, token);
      setRequests((prev) =>
        prev.map((request) => {
          if (request.id !== requestId) {
            return request;
          }
          return {
            ...request,
            likedByUser: response.liked,
            likeCount: response.likeCount,
          };
        })
      );
    } catch (likeError) {
      if (isAuthError(likeError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(likeError));
    }
  };

  const handleHelpToggle = async (request: RequestCard) => {
    try {
      if (request.helpedByUser) {
        await unhelpWithRequest(request.id, token);
        setRequests((prev) =>
          prev.map((item) =>
            item.id === request.id ? { ...item, helpedByUser: false } : item
          )
        );
      } else {
        await helpWithRequest(request.id, token);
        setRequests((prev) =>
          prev.map((item) =>
            item.id === request.id ? { ...item, helpedByUser: true } : item
          )
        );
      }
    } catch (helpError) {
      if (isAuthError(helpError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(helpError));
    }
  };

  const handleDelete = async (requestId: string) => {
    try {
      await deleteRequestById(requestId, token);
      setRequests((prev) => prev.filter((request) => request.id !== requestId));
    } catch (deleteError) {
      if (isAuthError(deleteError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(deleteError));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.sectionTitle}>Create Request</Text>
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="What do you need help with?"
        />
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multilineInput]}
          value={description}
          onChangeText={setDescription}
          placeholder="Add details"
          multiline
        />
        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="Campus city"
        />
        <View style={styles.rowBetween}>
          <Text style={styles.mutedText}>Remote request</Text>
          <ActionButton
            label={isRemote ? "Yes" : "No"}
            onPress={() => setIsRemote((prev) => !prev)}
            tone="muted"
          />
        </View>
        <ActionButton
          label={posting ? "Posting..." : "Post request"}
          onPress={() => {
            void submitRequest();
          }}
          disabled={posting}
        />
      </Card>

      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Open Requests</Text>
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

      {requests.map((request) => {
        const isOwn = request.creator.id === user.id;
        return (
          <Card key={request.id}>
            <Text style={styles.cardTitle}>{request.title}</Text>
            <Text style={styles.cardBody}>{request.description}</Text>
            <Text style={styles.mutedText}>By {request.creator.handle}</Text>
            <Text style={styles.mutedText}>Likes: {request.likeCount}</Text>
            <View style={styles.inlineActions}>
              <ActionButton
                label={request.likedByUser ? "Unlike" : "Like"}
                tone="muted"
                onPress={() => {
                  void handleLike(request.id);
                }}
              />
              <ActionButton
                label={request.helpedByUser ? "Withdraw help" : "Offer help"}
                tone="muted"
                onPress={() => {
                  void handleHelpToggle(request);
                }}
              />
              {isOwn ? (
                <ActionButton
                  label="Delete"
                  tone="danger"
                  onPress={() => {
                    void handleDelete(request.id);
                  }}
                />
              ) : null}
            </View>
          </Card>
        );
      })}

      {!loading && requests.length === 0 ? (
        <Text style={styles.emptyText}>No active requests.</Text>
      ) : null}
    </ScrollView>
  );
};
