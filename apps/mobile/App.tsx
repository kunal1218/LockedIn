import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { type AuthPayload, type AuthUser, getMe, login, signup } from "./src/api/actions";
import { AuthScreen } from "./src/screens/AuthScreen";
import { FeedTab } from "./src/screens/tabs/FeedTab";
import { FriendsTab } from "./src/screens/tabs/FriendsTab";
import { MapTab } from "./src/screens/tabs/MapTab";
import { ProfileTab } from "./src/screens/tabs/ProfileTab";
import { RequestsTab } from "./src/screens/tabs/RequestsTab";
import { formatError } from "./src/lib/errors";
import { persistAuth, readStoredAuth } from "./src/lib/storage";
import { styles } from "./src/styles/ui";

const appTabs = [
  { id: "home", label: "Home", icon: "⌂", iconActive: "⌂" },
  { id: "friends", label: "Friends", icon: "☻", iconActive: "☻" },
  { id: "map", label: "Map", icon: "⌖", iconActive: "⌖" },
  { id: "requests", label: "Requests", icon: "✉", iconActive: "✉" },
  { id: "profile", label: "Profile", icon: "◉", iconActive: "◉" },
] as const;

type AppTab = (typeof appTabs)[number]["id"];

export default function App() {
  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [booting, setBooting] = useState(true);
  const [authPending, setAuthPending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const bootstrap = useCallback(async () => {
    setBooting(true);
    setAuthError(null);

    try {
      const stored = await readStoredAuth();
      if (!stored?.token) {
        setAuth(null);
        return;
      }

      const payload = await getMe(stored.token);
      const nextAuth = {
        user: payload.user,
        token: stored.token,
      };
      setAuth(nextAuth);
      await persistAuth(nextAuth);
    } catch {
      setAuth(null);
      await persistAuth(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const updateAuth = useCallback(async (payload: AuthPayload | null) => {
    setAuth(payload);
    await persistAuth(payload);
  }, []);

  const handleLogin = useCallback(
    async (params: { email: string; password: string }) => {
      setAuthPending(true);
      setAuthError(null);
      try {
        const payload = await login(params);
        await updateAuth(payload);
      } catch (error) {
        setAuthError(formatError(error));
        throw error;
      } finally {
        setAuthPending(false);
      }
    },
    [updateAuth]
  );

  const handleSignup = useCallback(
    async (params: {
      name: string;
      email: string;
      password: string;
      handle?: string;
    }) => {
      setAuthPending(true);
      setAuthError(null);
      try {
        const payload = await signup(params);
        await updateAuth(payload);
      } catch (error) {
        setAuthError(formatError(error));
        throw error;
      } finally {
        setAuthPending(false);
      }
    },
    [updateAuth]
  );

  const handleLogout = useCallback(async () => {
    await updateAuth(null);
    setActiveTab("home");
  }, [updateAuth]);

  const handleAuthExpired = useCallback(() => {
    setAuthError("Session expired. Please log in again.");
    void handleLogout();
  }, [handleLogout]);

  const handleUserRefresh = useCallback(
    async (user: AuthUser) => {
      if (!auth) {
        return;
      }
      await updateAuth({
        token: auth.token,
        user,
      });
    },
    [auth, updateAuth]
  );

  const activeSession = useMemo(() => {
    if (!auth?.token || !auth.user) {
      return null;
    }
    return {
      token: auth.token,
      user: auth.user,
    };
  }, [auth]);

  if (booting) {
    return (
      <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
        <StatusBar style="dark" />
        <View style={styles.loaderContainer}>
          <ActivityIndicator color="#2563eb" size="large" />
          <Text style={styles.mutedText}>Loading session...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeSession) {
    return (
      <AuthScreen
        submitting={authPending}
        error={authError}
        onLogin={handleLogin}
        onSignup={handleSignup}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "left", "right"]}>
      <StatusBar style="dark" />
      <View style={[styles.body, activeTab !== "map" ? styles.bodyWithBottomInset : null]}>
        {activeTab === "home" ? (
          <FeedTab
            token={activeSession.token}
            user={activeSession.user}
            onAuthExpired={handleAuthExpired}
          />
        ) : null}
        {activeTab === "requests" ? (
          <RequestsTab
            token={activeSession.token}
            user={activeSession.user}
            onAuthExpired={handleAuthExpired}
          />
        ) : null}
        {activeTab === "map" ? (
          <MapTab
            token={activeSession.token}
            user={activeSession.user}
            onAuthExpired={handleAuthExpired}
          />
        ) : null}
        {activeTab === "friends" ? (
          <FriendsTab
            token={activeSession.token}
            user={activeSession.user}
            onAuthExpired={handleAuthExpired}
          />
        ) : null}
        {activeTab === "profile" ? (
          <ProfileTab
            token={activeSession.token}
            user={activeSession.user}
            onAuthExpired={handleAuthExpired}
            onLogout={handleLogout}
            onUserRefresh={handleUserRefresh}
          />
        ) : null}
      </View>

      <View style={styles.bottomNavOuter}>
        <View style={styles.bottomNav}>
          {appTabs.map((tab) => {
            const isActive = activeTab === tab.id;
            const isCenterTab = tab.id === "map";

            return (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.bottomTab, isCenterTab && styles.bottomTabCenter]}
              >
                {isCenterTab ? (
                  <View
                    style={[
                      styles.bottomCenterIconWrap,
                      isActive && styles.bottomCenterIconWrapActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.bottomTabIcon,
                        styles.bottomTabIconActive,
                        styles.bottomCenterTabIcon,
                      ]}
                    >
                      {isActive ? tab.iconActive : tab.icon}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.bottomTabIcon, isActive && styles.bottomTabIconActive]}>
                    {isActive ? tab.iconActive : tab.icon}
                  </Text>
                )}
                {!isCenterTab ? (
                  <Text style={[styles.bottomTabLabel, isActive && styles.bottomTabLabelActive]}>
                    {tab.label}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
