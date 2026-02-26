import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  type AuthUser,
  getMe,
  getUnreadNotificationCount,
  markNotificationsRead,
} from "../../api/actions";
import { API_BASE_URL } from "../../api/client";
import { ActionButton } from "../../components/ActionButton";
import { Card } from "../../components/Card";
import { formatError, isAuthError } from "../../lib/errors";
import type { SessionProps } from "../../types/session";
import { styles } from "../../styles/ui";

type ProfileTabProps = SessionProps & {
  onLogout: () => Promise<void>;
  onUserRefresh: (user: AuthUser) => Promise<void>;
};

export const ProfileTab = ({
  token,
  user,
  onAuthExpired,
  onLogout,
  onUserRefresh,
}: ProfileTabProps) => {
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mePayload, unreadPayload] = await Promise.all([
        getMe(token),
        getUnreadNotificationCount(token),
      ]);
      await onUserRefresh(mePayload.user);
      setUnreadCount(unreadPayload.unreadCount ?? 0);
    } catch (loadError) {
      if (isAuthError(loadError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(loadError));
    } finally {
      setLoading(false);
    }
  }, [onAuthExpired, onUserRefresh, token]);

  useEffect(() => {
    void load();
  }, [load]);

  const markRead = async () => {
    try {
      await markNotificationsRead(token);
      setUnreadCount(0);
    } catch (markError) {
      if (isAuthError(markError)) {
        onAuthExpired();
        return;
      }
      setError(formatError(markError));
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card>
        <Text style={styles.sectionTitle}>Profile</Text>
        <Text style={styles.cardTitle}>{user.name}</Text>
        <Text style={styles.mutedText}>{user.handle}</Text>
        <Text style={styles.mutedText}>{user.email}</Text>
        <Text style={styles.mutedText}>Coins: {user.coins ?? 0}</Text>
        <Text style={styles.mutedText}>Unread notifications: {unreadCount}</Text>

        <View style={styles.inlineActions}>
          <ActionButton
            label={loading ? "Refreshing..." : "Refresh"}
            onPress={() => {
              void load();
            }}
            disabled={loading}
            tone="muted"
          />
          <ActionButton
            label="Mark notifications read"
            onPress={() => {
              void markRead();
            }}
            tone="muted"
          />
        </View>

        <ActionButton
          label="Log out"
          tone="danger"
          onPress={() => {
            void onLogout();
          }}
        />
      </Card>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Card>
        <Text style={styles.sectionTitle}>Environment</Text>
        <Text style={styles.mutedText}>API base: {API_BASE_URL}</Text>
      </Card>
    </ScrollView>
  );
};
