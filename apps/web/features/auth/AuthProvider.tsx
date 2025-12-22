"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { apiPost } from "@/lib/api";

export type AuthUser = {
  id: string;
  name: string;
  handle: string;
  email: string;
};

type AuthPayload = {
  user: AuthUser;
  token: string;
};

type AuthModalMode = "login" | "signup";

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  setAuthModalMode: (mode: AuthModalMode) => void;
  login: (params: { email: string; password: string }) => Promise<void>;
  signup: (params: {
    name: string;
    email: string;
    password: string;
    handle?: string;
  }) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = "lockedin_auth";

const readStoredAuth = (): AuthPayload | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as AuthPayload;
  } catch {
    return null;
  }
};

const persistAuth = (payload: AuthPayload | null) => {
  if (typeof window === "undefined") {
    return;
  }

  if (!payload) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [auth, setAuth] = useState<AuthPayload | null>(() => readStoredAuth());
  const [isAuthModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>("signup");

  const updateAuth = useCallback((payload: AuthPayload | null) => {
    setAuth(payload);
    persistAuth(payload);
  }, []);

  const openAuthModal = useCallback((mode?: AuthModalMode) => {
    if (mode) {
      setAuthModalMode(mode);
    } else {
      setAuthModalMode("signup");
    }
    setAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalOpen(false);
  }, []);

  const login = useCallback(
    async ({ email, password }: { email: string; password: string }) => {
      const payload = await apiPost<AuthPayload>("/auth/login", {
        email,
        password,
      });
      updateAuth(payload);
    },
    [updateAuth]
  );

  const signup = useCallback(
    async ({
      name,
      email,
      password,
      handle,
    }: {
      name: string;
      email: string;
      password: string;
      handle?: string;
    }) => {
      const payload = await apiPost<AuthPayload>("/auth/signup", {
        name,
        email,
        password,
        handle,
      });
      updateAuth(payload);
    },
    [updateAuth]
  );

  const logout = useCallback(() => {
    updateAuth(null);
  }, [updateAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: auth?.user ?? null,
      token: auth?.token ?? null,
      isAuthenticated: Boolean(auth?.token),
      isAuthModalOpen,
      authModalMode,
      openAuthModal,
      closeAuthModal,
      setAuthModalMode,
      login,
      signup,
      logout,
    }),
    [
      auth,
      authModalMode,
      closeAuthModal,
      isAuthModalOpen,
      login,
      logout,
      openAuthModal,
      signup,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
};
