import { useState } from "react";
import {
  ScrollView,
  Text,
  TextInput,
  Pressable,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE_URL } from "../api/client";
import { ActionButton } from "../components/ActionButton";
import { Card } from "../components/Card";
import { formatError } from "../lib/errors";
import { styles } from "../styles/ui";

type AuthScreenProps = {
  submitting: boolean;
  error: string | null;
  onLogin: (params: { email: string; password: string }) => Promise<void>;
  onSignup: (params: {
    name: string;
    email: string;
    password: string;
    handle?: string;
  }) => Promise<void>;
};

export const AuthScreen = ({
  submitting,
  error,
  onLogin,
  onSignup,
}: AuthScreenProps) => {
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    setLocalError(null);

    if (!email.trim() || !password.trim()) {
      setLocalError("Email and password are required.");
      return;
    }

    try {
      if (mode === "login") {
        await onLogin({
          email: email.trim(),
          password,
        });
        return;
      }

      if (!name.trim()) {
        setLocalError("Name is required for signup.");
        return;
      }

      await onSignup({
        name: name.trim(),
        email: email.trim(),
        password,
        handle: handle.trim() || undefined,
      });
    } catch (submitError) {
      setLocalError(formatError(submitError));
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.authContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brandTitle}>LockedIn Mobile</Text>
        <Text style={styles.subtitle}>
          Expo Go client using the same action endpoints as web.
        </Text>

        <Card>
          <Pressable
            style={styles.modeSwitchRow}
            onPress={() => {
              setMode((prev) => (prev === "signup" ? "login" : "signup"));
            }}
          >
            <Pressable
              style={[styles.modePill, mode === "signup" && styles.modePillActive]}
              onPress={() => setMode("signup")}
            >
              <Text
                style={[
                  styles.modePillLabel,
                  mode === "signup" && styles.modePillLabelActive,
                ]}
              >
                Sign up
              </Text>
            </Pressable>
            <Pressable
              style={[styles.modePill, mode === "login" && styles.modePillActive]}
              onPress={() => setMode("login")}
            >
              <Text
                style={[
                  styles.modePillLabel,
                  mode === "login" && styles.modePillLabelActive,
                ]}
              >
                Log in
              </Text>
            </Pressable>
          </Pressable>

          {mode === "signup" ? (
            <>
              <Text style={styles.label}>Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="Your full name"
                autoCapitalize="words"
              />

              <Text style={styles.label}>Handle (optional)</Text>
              <TextInput
                style={styles.input}
                value={handle}
                onChangeText={setHandle}
                placeholder="@yourhandle"
                autoCapitalize="none"
              />
            </>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@college.edu"
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            secureTextEntry
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          {localError ? <Text style={styles.errorText}>{localError}</Text> : null}

          <ActionButton
            label={
              submitting
                ? "Please wait..."
                : mode === "signup"
                ? "Create account"
                : "Log in"
            }
            onPress={() => {
              void submit();
            }}
            disabled={submitting}
          />
        </Card>

        <Text style={styles.configText}>API base: {API_BASE_URL}</Text>
        <Text style={styles.configSubtext}>
          Mobile defaults to the production Railway backend. Override
          `EXPO_PUBLIC_API_BASE_URL` only when testing a local API server.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};
