import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, Text, View } from "react-native";
import { type AuthPayload, type AuthUser, getMe, login, signup } from "./src/api/actions";
import { AuthScreen } from "./src/screens/AuthScreen";
import { FeedTab } from "./src/screens/tabs/FeedTab";
import { FriendsTab } from "./src/screens/tabs/FriendsTab";
import { MarketplaceTab } from "./src/screens/tabs/MarketplaceTab";
import { ProfileTab } from "./src/screens/tabs/ProfileTab";
import { RequestsTab } from "./src/screens/tabs/RequestsTab";
import { formatError } from "./src/lib/errors";
import { persistAuth, readStoredAuth } from "./src/lib/storage";
import { styles } from "./src/styles/ui";

const appTabs = [
  { id: "feed", label: "Feed" },
  { id: "requests", label: "Requests" },
  { id: "marketplace", label: "Marketplace" },
  { id: "friends", label: "Friends" },
  { id: "profile", label: "Profile" },
] as const;

type AppTab = (typeof appTabs)[number]["id"];

export default function App() {
  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("feed");
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
    setActiveTab("feed");
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
      <SafeAreaView style={styles.safeArea}>
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>LockedIn</Text>
          <Text style={styles.headerSubtitle}>{activeSession.user.handle}</Text>
        </View>
      </View>

      <ScrollView
        horizontal
        style={styles.tabBarScroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabBar}
      >
        {appTabs.map((tab) => (
          <Pressable
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
          >
            <Text
              style={[
                styles.tabButtonLabel,
                activeTab === tab.id && styles.tabButtonLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.body}>
        {activeTab === "feed" ? (
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
        {activeTab === "marketplace" ? (
          <MarketplaceTab
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
    </SafeAreaView>
  );
}
