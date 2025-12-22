"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useAuth } from "@/features/auth";
import { apiGet, apiPost } from "@/lib/api";

type MadlibAnswers = {
  when: string;
  focus: string;
  action: string;
};

export type ProfileAnswers = {
  career: string;
  madlib: MadlibAnswers;
  memory: string;
};

type ProfileAnswersContextValue = {
  answers: ProfileAnswers | null;
  saveAnswers: (answers: ProfileAnswers) => Promise<void>;
  needsQuestionnaire: boolean;
  isLoaded: boolean;
  madlibAnswer: string;
};

const ProfileAnswersContext = createContext<ProfileAnswersContextValue | null>(null);

const storageKey = (userId: string) => `lockedin_profile_answers:${userId}`;

const sanitizeAnswers = (value: ProfileAnswers): ProfileAnswers => ({
  career: value.career.trim(),
  madlib: {
    when: value.madlib.when.trim(),
    focus: value.madlib.focus.trim(),
    action: value.madlib.action.trim(),
  },
  memory: value.memory.trim(),
});

const readStoredAnswers = (userId: string): ProfileAnswers | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(storageKey(userId));
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ProfileAnswers>;
    return {
      career: parsed.career ?? "",
      madlib: {
        when: parsed.madlib?.when ?? "",
        focus: parsed.madlib?.focus ?? "",
        action: parsed.madlib?.action ?? "",
      },
      memory: parsed.memory ?? "",
    };
  } catch {
    return null;
  }
};

const writeStoredAnswers = (userId: string, answers: ProfileAnswers) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(userId), JSON.stringify(answers));
};

const hasCompleteAnswers = (answers: ProfileAnswers | null) => {
  if (!answers) {
    return false;
  }

  return Boolean(
    answers.career &&
      answers.memory &&
      answers.madlib.when &&
      answers.madlib.focus &&
      answers.madlib.action
  );
};

const buildMadlibAnswer = (answers: ProfileAnswers | null) => {
  if (!answers) {
    return "";
  }

  const { when, focus, action } = answers.madlib;
  if (!when || !focus || !action) {
    return "";
  }

  return `Whenever I'm ${when}, my ${focus} stop and ${action}.`;
};

export const ProfileAnswersProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated, token } = useAuth();
  const [answers, setAnswers] = useState<ProfileAnswers | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadAnswers = async () => {
      if (!user?.id || !token) {
        if (isActive) {
          setAnswers(null);
          setIsLoaded(true);
        }
        return;
      }

      setIsLoaded(false);

      try {
        const response = await apiGet<{ answers: ProfileAnswers | null }>(
          "/profile/answers",
          token
        );

        if (!isActive) {
          return;
        }

        if (response?.answers) {
          setAnswers(response.answers);
          writeStoredAnswers(user.id, response.answers);
          setIsLoaded(true);
          return;
        }

        const stored = readStoredAnswers(user.id);
        if (stored && hasCompleteAnswers(stored)) {
          setAnswers(stored);
          writeStoredAnswers(user.id, stored);
          setIsLoaded(true);
          await apiPost<{ answers: ProfileAnswers }>(
            "/profile/answers",
            stored,
            token
          );
          return;
        }

        setAnswers(response?.answers ?? null);
        setIsLoaded(true);
      } catch (error) {
        console.error("Profile answers fetch failed:", error);
        const stored = user?.id ? readStoredAnswers(user.id) : null;
        if (isActive) {
          setAnswers(stored);
          setIsLoaded(true);
        }
      }
    };

    loadAnswers();
    return () => {
      isActive = false;
    };
  }, [token, user?.id]);

  const saveAnswers = useCallback(
    async (next: ProfileAnswers) => {
      if (!user?.id || !token) {
        return;
      }
      const sanitized = sanitizeAnswers(next);
      const response = await apiPost<{ answers: ProfileAnswers }>(
        "/profile/answers",
        sanitized,
        token
      );
      const saved = response?.answers ?? sanitized;
      setAnswers(saved);
      writeStoredAnswers(user.id, saved);
    },
    [token, user?.id]
  );

  const needsQuestionnaire =
    Boolean(user?.id) && isAuthenticated && isLoaded && !hasCompleteAnswers(answers);

  const madlibAnswer = useMemo(() => buildMadlibAnswer(answers), [answers]);

  const value = useMemo<ProfileAnswersContextValue>(
    () => ({
      answers,
      saveAnswers,
      needsQuestionnaire,
      isLoaded,
      madlibAnswer,
    }),
    [answers, isLoaded, madlibAnswer, needsQuestionnaire, saveAnswers]
  );

  return (
    <ProfileAnswersContext.Provider value={value}>
      {children}
    </ProfileAnswersContext.Provider>
  );
};

export const useProfileAnswers = () => {
  const context = useContext(ProfileAnswersContext);

  if (!context) {
    throw new Error("useProfileAnswers must be used within ProfileAnswersProvider");
  }

  return context;
};

export const getEmptyProfileAnswers = (): ProfileAnswers => ({
  career: "",
  madlib: {
    when: "",
    focus: "",
    action: "",
  },
  memory: "",
});
