import AsyncStorage from "@react-native-async-storage/async-storage";
import type { AuthPayload } from "../api/actions";

export const AUTH_STORAGE_KEY = "lockedin_auth";

export const readStoredAuth = async (): Promise<AuthPayload | null> => {
  try {
    const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as AuthPayload;
  } catch {
    return null;
  }
};

export const persistAuth = async (payload: AuthPayload | null): Promise<void> => {
  if (!payload) {
    await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
    return;
  }

  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
};
