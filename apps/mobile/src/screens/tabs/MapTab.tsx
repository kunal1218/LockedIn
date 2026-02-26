import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import type { SessionProps } from "../../types/session";

const DEFAULT_WEB_APP_URL = "https://quadblitz.com";
const WEB_APP_BASE_URL =
  (process.env.EXPO_PUBLIC_WEB_APP_URL ?? DEFAULT_WEB_APP_URL).replace(/\/$/, "");
const MAP_EMBED_VERSION = "app-compact-v2";

export const MapTab = ({ token, user }: SessionProps) => {
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const mapUrl = useMemo(
    () => `${WEB_APP_BASE_URL}/map?embedded=1&mobile=1&compact=1&v=${MAP_EMBED_VERSION}`,
    []
  );
  const injectedScript = useMemo(() => {
    const payload = { token, user };
    const serializedPayload = JSON.stringify(payload);
    const escapedPayload = JSON.stringify(serializedPayload);
    return `
      (function() {
        var applyEmbeddedTweaks = function() {
          try {
            document.documentElement.style.margin = "0";
            document.documentElement.style.padding = "0";
            document.documentElement.style.height = "100%";
            document.documentElement.style.overflow = "hidden";
            document.body.style.margin = "0";
            document.body.style.padding = "0";
            document.body.style.height = "100%";
            document.body.style.overflow = "hidden";

            var header = document.querySelector("header");
            if (header) {
              header.style.display = "none";
            }

            var main = document.querySelector("main");
            if (main) {
              main.style.paddingTop = "0";
              main.style.marginTop = "0";
              main.style.height = "100%";
              main.style.minHeight = "100%";
              main.style.overflow = "hidden";
            }

            var appRoot = document.querySelector("body > div");
            if (appRoot) {
              appRoot.style.height = "100%";
              appRoot.style.minHeight = "100%";
              appRoot.style.overflow = "hidden";
            }

            var mapbox = document.querySelector(".mapboxgl-map");
            if (mapbox && mapbox.parentElement && mapbox.parentElement.parentElement) {
              var mapRoot = mapbox.parentElement.parentElement;
              mapRoot.style.position = "fixed";
              mapRoot.style.left = "0";
              mapRoot.style.top = "0";
              mapRoot.style.right = "0";
              mapRoot.style.bottom = "0";
              mapRoot.style.width = "100vw";
              mapRoot.style.height = "100vh";
              mapRoot.style.minHeight = "100vh";
              mapRoot.style.maxHeight = "100vh";
              mapRoot.style.margin = "0";
              mapRoot.style.padding = "0";
              mapRoot.style.overflow = "hidden";
            }

            var topControls = document.querySelector('div[class*="pointer-events-none"][class*="absolute"][class*="z-20"][class*="top-"]');
            if (topControls) {
              topControls.style.top = "10px";
              topControls.style.right = "10px";
              topControls.style.width = "225px";
              topControls.style.gap = "8px";
              topControls.style.transform = "scale(0.86)";
              topControls.style.transformOrigin = "top right";
            }

            var cards = document.querySelectorAll('div[class*="rounded-2xl"][class*="bg-white"]');
            cards.forEach(function(card) {
              var text = card.textContent || "";
              if (
                text.indexOf("Share my location") !== -1 ||
                text.indexOf("Go ghost") !== -1 ||
                text.indexOf("Go public") !== -1
              ) {
                card.style.padding = "8px";
                card.style.maxWidth = "225px";
              }
            });

            var actionButtons = document.querySelectorAll("button");
            actionButtons.forEach(function(button) {
              var label = (button.textContent || "").trim();
              if (
                label === "Ghosted" ||
                label === "Go ghost" ||
                label === "Public" ||
                label === "Private"
              ) {
                button.style.minHeight = "34px";
                button.style.padding = "4px 10px";
                button.style.fontSize = "11px";
              }
              if (label === "+" || label === "×") {
                button.style.width = "48px";
                button.style.height = "48px";
                button.style.fontSize = "22px";
              }
              if (label.indexOf("View Events") === 0) {
                button.style.position = "absolute";
                button.style.left = "12px";
                button.style.bottom = "104px";
                button.style.padding = "8px 14px";
                button.style.fontSize = "12px";
              }
            });

            var mapButtons = document.querySelectorAll(
              'button[aria-label="Go to my location"], button[aria-label="Go to campus"], button[aria-label="Zoom in"], button[aria-label="Zoom out"]'
            );
            mapButtons.forEach(function(button) {
              button.style.width = "40px";
              button.style.height = "40px";
            });

            var mapDock = document.querySelector('div[class*="absolute"][class*="right-4"][class*="z-20"]');
            if (mapDock) {
              mapDock.style.right = "12px";
              mapDock.style.bottom = "104px";
            }
          } catch (error) {}
        };

        try {
          window.localStorage.setItem("lockedin_auth", ${escapedPayload});
        } catch (error) {}
        applyEmbeddedTweaks();
        window.addEventListener("load", applyEmbeddedTweaks);
        setTimeout(applyEmbeddedTweaks, 200);
        setTimeout(applyEmbeddedTweaks, 800);
        setTimeout(applyEmbeddedTweaks, 1600);
        var observer = new MutationObserver(function() {
          applyEmbeddedTweaks();
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
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
        cacheEnabled={false}
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
