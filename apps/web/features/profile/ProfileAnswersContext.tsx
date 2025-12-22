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
  saveAnswers: (answers: ProfileAnswers) => void;
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
  const { user, isAuthenticated } = useAuth();
  const [answers, setAnswers] = useState<ProfileAnswers | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!user?.id) {
      setAnswers(null);
      setIsLoaded(true);
      return;
    }

    const stored = readStoredAnswers(user.id);
    setAnswers(stored);
    setIsLoaded(true);
  }, [user?.id]);

  const saveAnswers = useCallback(
    (next: ProfileAnswers) => {
      if (!user?.id) {
        return;
      }
      const sanitized = sanitizeAnswers(next);
      setAnswers(sanitized);
      writeStoredAnswers(user.id, sanitized);
    },
    [user?.id]
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
