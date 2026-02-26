import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { SessionProps } from "../../types/session";

const DEFAULT_WEB_APP_URL = "https://quadblitz.com";
const WEB_APP_BASE_URL =
  (process.env.EXPO_PUBLIC_WEB_APP_URL ?? DEFAULT_WEB_APP_URL).replace(/\/$/, "");

export const MapTab = ({ token, user }: SessionProps) => {
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const mapUrl = useMemo(() => `${WEB_APP_BASE_URL}/map?embedded=1`, []);
  const injectedScript = useMemo(() => {
    const payload = { token, user };
    const serializedPayload = JSON.stringify(payload);
    const escapedPayload = JSON.stringify(serializedPayload);
    return `
      (function() {
        try {
          window.localStorage.setItem("lockedin_auth", ${escapedPayload});
        } catch (error) {}
        true;
      })();
    `;
  }, [token, user]);

  return (
    <View style={mapStyles.root}>
      <WebView
        key={`${reloadKey}-${token}`}
        source={{ uri: mapUrl }}
        javaScriptEnabled
        domStorageEnabled
        geolocationEnabled
        setSupportMultipleWindows={false}
        injectedJavaScriptBeforeContentLoaded={injectedScript}
        onLoadStart={() => {
          setLoading(true);
          setError(null);
        }}
        onLoadEnd={() => {
          setLoading(false);
        }}
        onError={(event) => {
          setLoading(false);
          setError(event.nativeEvent.description || "Failed to load map.");
        }}
        onHttpError={(event) => {
          setLoading(false);
          setError(`Map page failed to load (HTTP ${event.nativeEvent.statusCode}).`);
        }}
      />

      {isLoading ? (
        <View style={mapStyles.loadingOverlay}>
          <ActivityIndicator color="#ffffff" size="small" />
          <Text style={mapStyles.loadingText}>Loading map...</Text>
        </View>
      ) : null}

      {error ? (
        <View style={mapStyles.errorBanner}>
          <Text style={mapStyles.errorText}>{error}</Text>
          <Pressable
            style={mapStyles.retryButton}
            onPress={() => {
              setReloadKey((prev) => prev + 1);
            }}
          >
            <Text style={mapStyles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const mapStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  loadingOverlay: {
    position: "absolute",
    top: 12,
    left: 12,
    right: 12,
    borderRadius: 12,
    backgroundColor: "rgba(15, 23, 42, 0.82)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
  errorBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 12,
    borderRadius: 12,
    backgroundColor: "rgba(127, 29, 29, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  errorText: {
    color: "#fee2e2",
    fontSize: 12,
    fontWeight: "600",
  },
  retryButton: {
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryLabel: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "700",
  },
});
