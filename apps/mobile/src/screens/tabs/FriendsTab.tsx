import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  type DirectMessage,
  type FriendSummary,
  acceptFriendRequest,
  deleteDirectMessage,
  getFriendSummary,
  getMessagesWithUser,
  removeFriend,
  removePendingFriend,
  sendFriendRequest,
  sendMessageToUser,
  updateDirectMessage,
} from "../../api/actions";
import { ActionButton } from "../../components/ActionButton";
import { Card } from "../../components/Card";
import { formatError, isAuthError } from "../../lib/errors";
import { formatDateTime } from "../../lib/time";
import type { SessionProps } from "../../types/session";
import { styles } from "../../styles/ui";

export const FriendsTab = ({ token, user, onAuthExpired }: SessionProps) => {
  const [summary, setSummary] = useState<FriendSummary | null>(null);
  const [requestHandle, setRequestHandle] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedHandle, setSelectedHandle] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<DirectMessage[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [threadDraft, setThreadDraft] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSummary = await getFriendSummary(token);
      setSummary(nextSummary);
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

  const loadThread = useCallback(
    async (handle: string) => {
      setThreadLoading(true);
      setThreadError(null);
      try {
        const payload = await getMessagesWithUser(handle, token);
        setThreadMessages(payload.messages ?? []);
      } catch (loadError) {
        if (isAuthError(loadError)) {
          onAuthExpired();
          return;
        }
        setThreadError(formatError(loadError));
      } finally {
        setThreadLoading(false);
      }
    },
    [onAuthExpired, token]
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedHandle) {
      return;
    }

    void loadThread(selectedHandle);
  }, [loadThread, selectedHandle]);

  const submitRequest = async () => {
    const handle = requestHandle.trim().replace(/^@/, "");
    if (!handle) {
      return;
    }

    setSending(true);
    setError(null);

    try {
      await sendFriendRequest(handle, token);
      setRequestHandle("");
      await load();
    } catch (requestError) {
      if (isAuthError(requestError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(requestError));
    } finally {
      setSending(false);
    }
  };

  const runActionAndRefresh = async (action: () => Promise<void>) => {
    try {
      await action();
      await load();
    } catch (actionError) {
      if (isAuthError(actionError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(actionError));
    }
  };

  const selectedFriend = useMemo(
    () =>
      summary?.friends.find(
        (friend) => friend.handle.replace(/^@/, "") === selectedHandle
      ) ?? null,
    [selectedHandle, summary?.friends]
  );

  const sendMessage = async () => {
    if (!selectedHandle) {
      return;
    }

    const messageBody = threadDraft.trim();
    if (!messageBody) {
      return;
    }

    setSendingMessage(true);
    setThreadError(null);

    try {
      const payload = await sendMessageToUser(selectedHandle, messageBody, token);
      setThreadMessages((prev) => [...prev, payload.message]);
      setThreadDraft("");
    } catch (messageError) {
      if (isAuthError(messageError)) {
        onAuthExpired();
        return;
      }
      setThreadError(formatError(messageError));
    } finally {
      setSendingMessage(false);
    }
  };

  const startEdit = (message: DirectMessage) => {
    setEditingMessageId(message.id);
    setEditDraft(message.body);
  };

  const saveEditMessage = async () => {
    if (!editingMessageId) {
      return;
    }

    const nextBody = editDraft.trim();
    if (!nextBody) {
      return;
    }

    setSavingEdit(true);
    setThreadError(null);

    try {
      const payload = await updateDirectMessage(editingMessageId, nextBody, token);
      setThreadMessages((prev) =>
        prev.map((message) =>
          message.id === editingMessageId ? payload.message : message
        )
      );
      setEditingMessageId(null);
      setEditDraft("");
    } catch (editError) {
      if (isAuthError(editError)) {
        onAuthExpired();
        return;
      }
      setThreadError(formatError(editError));
    } finally {
      setSavingEdit(false);
    }
  };

  const removeMessage = async (messageId: string) => {
    setThreadError(null);
    try {
      await deleteDirectMessage(messageId, token);
      setThreadMessages((prev) => prev.filter((message) => message.id !== messageId));
      if (editingMessageId === messageId) {
        setEditingMessageId(null);
        setEditDraft("");
      }
    } catch (deleteError) {
      if (isAuthError(deleteError)) {
        onAuthExpired();
        return;
      }
      setThreadError(formatError(deleteError));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContainer} keyboardShouldPersistTaps="handled">
      <Card>
        <Text style={styles.sectionTitle}>Add Friend</Text>
        <TextInput
          style={styles.input}
          value={requestHandle}
          onChangeText={setRequestHandle}
          placeholder="Enter handle"
          autoCapitalize="none"
        />
        <ActionButton
          label={sending ? "Sending..." : "Send request"}
          onPress={() => {
            void submitRequest();
          }}
          disabled={sending}
        />
      </Card>

      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>Network</Text>
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

      {summary ? (
        <>
          <Card>
            <Text style={styles.cardTitle}>Incoming Requests ({summary.incoming.length})</Text>
            {summary.incoming.map((request) => (
              <View style={styles.friendRow} key={request.id}>
                <Text style={styles.mutedText}>{request.requester.handle}</Text>
                <View style={styles.inlineActions}>
                  <ActionButton
                    label="Accept"
                    tone="muted"
                    onPress={() => {
                      void runActionAndRefresh(() =>
                        acceptFriendRequest(request.requester.handle, token)
                      );
                    }}
                  />
                  <ActionButton
                    label="Decline"
                    tone="danger"
                    onPress={() => {
                      void runActionAndRefresh(() =>
                        removePendingFriend(request.requester.handle, token)
                      );
                    }}
                  />
                </View>
              </View>
            ))}
            {summary.incoming.length === 0 ? (
              <Text style={styles.emptyText}>No incoming requests.</Text>
            ) : null}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Outgoing Requests ({summary.outgoing.length})</Text>
            {summary.outgoing.map((request) => (
              <View style={styles.friendRow} key={request.id}>
                <Text style={styles.mutedText}>{request.recipient.handle}</Text>
                <ActionButton
                  label="Cancel"
                  tone="danger"
                  onPress={() => {
                    void runActionAndRefresh(() =>
                      removePendingFriend(request.recipient.handle, token)
                    );
                  }}
                />
              </View>
            ))}
            {summary.outgoing.length === 0 ? (
              <Text style={styles.emptyText}>No outgoing requests.</Text>
            ) : null}
          </Card>

          <Card>
            <Text style={styles.cardTitle}>Friends ({summary.friends.length})</Text>
            {summary.friends.map((friend) => (
              <View style={styles.friendRow} key={friend.id}>
                <Text style={styles.mutedText}>{friend.handle}</Text>
                <View style={styles.inlineActions}>
                  <ActionButton
                    label={
                      selectedHandle === friend.handle.replace(/^@/, "")
                        ? "Viewing chat"
                        : "Open chat"
                    }
                    tone="muted"
                    onPress={() => {
                      setSelectedHandle(friend.handle.replace(/^@/, ""));
                    }}
                  />
                  <ActionButton
                    label="Remove"
                    tone="danger"
                    onPress={() => {
                      void runActionAndRefresh(() => removeFriend(friend.handle, token));
                    }}
                  />
                </View>
              </View>
            ))}
            {summary.friends.length === 0 ? (
              <Text style={styles.emptyText}>No friends yet.</Text>
            ) : null}
          </Card>
        </>
      ) : null}

      {selectedHandle ? (
        <Card>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>
              Chat with {selectedFriend?.handle ?? selectedHandle}
            </Text>
            <ActionButton
              label={threadLoading ? "Refreshing..." : "Refresh"}
              tone="muted"
              onPress={() => {
                void loadThread(selectedHandle);
              }}
              disabled={threadLoading}
            />
          </View>

          {threadError ? <Text style={styles.errorText}>{threadError}</Text> : null}
          {threadLoading ? <ActivityIndicator color="#2563eb" /> : null}

          <View style={styles.messageList}>
            {threadMessages.map((message) => {
              const isMine = message.sender.id === user.id;
              return (
                <View
                  key={message.id}
                  style={[styles.messageBubble, isMine ? styles.messageBubbleMine : null]}
                >
                  <Text style={styles.messageMeta}>
                    {message.sender.handle} • {formatDateTime(message.createdAt)}
                  </Text>

                  {editingMessageId === message.id ? (
                    <>
                      <TextInput
                        style={[styles.input, styles.compactInput]}
                        value={editDraft}
                        onChangeText={setEditDraft}
                        multiline
                      />
                      <View style={styles.inlineActions}>
                        <ActionButton
                          label={savingEdit ? "Saving..." : "Save"}
                          onPress={() => {
                            void saveEditMessage();
                          }}
                          disabled={savingEdit}
                          tone="muted"
                        />
                        <ActionButton
                          label="Cancel"
                          onPress={() => {
                            setEditingMessageId(null);
                            setEditDraft("");
                          }}
                          tone="muted"
                        />
                      </View>
                    </>
                  ) : (
                    <>
                      <Text style={styles.messageBody}>{message.body}</Text>
                      {isMine ? (
                        <View style={styles.inlineActions}>
                          <ActionButton
                            label="Edit"
                            tone="muted"
                            onPress={() => startEdit(message)}
                          />
                          <ActionButton
                            label="Delete"
                            tone="danger"
                            onPress={() => {
                              void removeMessage(message.id);
                            }}
                          />
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              );
            })}
            {!threadLoading && threadMessages.length === 0 ? (
              <Text style={styles.emptyText}>No messages yet.</Text>
            ) : null}
          </View>

          <View style={styles.composeRow}>
            <TextInput
              style={[styles.input, styles.compactInput]}
              value={threadDraft}
              onChangeText={setThreadDraft}
              placeholder="Type a message"
              multiline
            />
            <ActionButton
              label={sendingMessage ? "Sending..." : "Send"}
              onPress={() => {
                void sendMessage();
              }}
              disabled={sendingMessage}
            />
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
};
