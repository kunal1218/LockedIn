import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text } from "react-native";
import { getFriendLocations } from "../../api/actions";
import { Card } from "../../components/Card";
import { formatError, isAuthError } from "../../lib/errors";
import { styles } from "../../styles/ui";
import type { SessionProps } from "../../types/session";

const parseFriendCount = (payload: unknown): number | null => {
  if (Array.isArray(payload)) {
    return payload.length;
  }

  if (typeof payload === "object" && payload !== null) {
    const data = payload as Record<string, unknown>;
    if (Array.isArray(data.friends)) {
      return data.friends.length;
    }
    if (Array.isArray(data.locations)) {
      return data.locations.length;
    }
    if (Array.isArray(data.users)) {
      return data.users.length;
    }
  }

  return null;
};

export const MapTab = ({ token, onAuthExpired }: SessionProps) => {
  const [friendCount, setFriendCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await getFriendLocations(token);
      setFriendCount(parseFriendCount(response));
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

  return (
    <ScrollView contentContainerStyle={styles.tabContainer}>
      <Card>
        <Text style={styles.sectionTitle}>Map</Text>
        <Text style={styles.cardBody}>
          Mobile map is being polished. This tab is already wired to the same backend map endpoints.
        </Text>
        <Pressable style={styles.button} onPress={() => void load()} disabled={loading}>
          <Text style={styles.buttonLabel}>{loading ? "Refreshing..." : "Refresh map data"}</Text>
        </Pressable>
      </Card>

      <Card>
        <Text style={styles.cardTitle}>Friend visibility</Text>
        {loading ? <ActivityIndicator color="#2563eb" /> : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {!loading && !error ? (
          <Text style={styles.cardBody}>
            {friendCount === null
              ? "Live locations are enabled. No friend count was returned by the endpoint response."
              : `${friendCount} friend location${friendCount === 1 ? "" : "s"} currently visible.`}
          </Text>
        ) : null}
      </Card>
    </ScrollView>
  );
};
