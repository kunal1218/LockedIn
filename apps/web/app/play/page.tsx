"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { useAuth } from "@/features/auth";
import { apiGet, apiPatch, apiPost } from "@/lib/api";

type MessageUser = {
  id: string;
  name: string;
  handle: string;
};

type RankedMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: MessageUser;
  edited?: boolean;
};

type TypingTestPayload = {
  state: "idle" | "countdown" | "active" | "result";
  words: string[];
  startedAt?: string;
  resultAt?: string;
  winnerId?: string | null;
  round?: number;
};

type RankedStatus =
  | { status: "idle" }
  | { status: "waiting" }
  | {
      status: "matched";
      matchId: string;
      opponents: MessageUser[];
      startedAt: string;
      lives?: { me: number; opponents: number[] };
      turnStartedAt?: string;
      serverTime?: string;
      isMyTurn?: boolean;
      currentTurnUserId?: string | null;
      isJudge?: boolean;
      judgeUserId?: string | null;
      icebreakerQuestion?: string | null;
      characterRole?: string | null;
      characterRoleAssignedAt?: string | null;
    };

const inputClasses =
  "w-full rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60 focus:bg-white";

const TURN_SECONDS = 15;
const TYPING_TEST_MODAL_SECONDS = 3;
const ROLE_MODAL_SECONDS = 5;

export default function RankedPlayPage() {
  const { isAuthenticated, token, user, openAuthModal } = useAuth();
  const [rankedStatus, setRankedStatus] = useState<RankedStatus>({ status: "idle" });
  const [queueError, setQueueError] = useState<string | null>(null);
  const [isQueuing, setIsQueuing] = useState(false);
  const [messages, setMessages] = useState<RankedMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [isTimeout, setIsTimeout] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number>(TURN_SECONDS);
  const [hasMatchEnded, setHasMatchEnded] = useState(false);
  const [lastMatchSnapshot, setLastMatchSnapshot] = useState<{
    opponents: MessageUser[];
    lives: { me: number; opponents: number[] };
    judgeUserId: string | null;
    isJudge: boolean;
  } | null>(null);
  const [opponentTyping, setOpponentTyping] = useState("");
  const [typingTest, setTypingTest] = useState<TypingTestPayload>({
    state: "idle",
    words: [],
  });
  const [typingAttempt, setTypingAttempt] = useState("");
  const [typingTestError, setTypingTestError] = useState<string | null>(null);
  const [isTypingSubmitting, setIsTypingSubmitting] = useState(false);
  const [typingModalTick, setTypingModalTick] = useState(0);
  const [roleModalTick, setRoleModalTick] = useState(0);
  const [roleModalStartMs, setRoleModalStartMs] = useState<number | null>(null);
  const [isSmiting, setIsSmiting] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const turnTimeoutReportedRef = useRef<string | null>(null);
  const hasLoadedMessagesRef = useRef<boolean>(false);
  const isLoadingMessagesRef = useRef<boolean>(false);
  const activeMatchIdRef = useRef<string | null>(null);
  const roleModalSeenRef = useRef<Record<string, boolean>>({});
  const justSentRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const serverTimeOffsetRef = useRef<number>(0);
  const turnStartedAtRef = useRef<string | null>(null);
  const typingDebounceRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef<string>("");
  const typingRoundRef = useRef<number | null>(null);
  const lives =
    rankedStatus.status === "matched"
      ? rankedStatus.lives ?? { me: 3, opponents: [3, 3] }
      : null;
  const maybeStartRoleModal = useCallback((matchId: string | null) => {
    if (!matchId) {
      return;
    }
    if (roleModalSeenRef.current[matchId]) {
      return;
    }
    roleModalSeenRef.current[matchId] = true;
    setRoleModalStartMs(Date.now());
  }, []);
  const derivedIsMyTurn = useMemo(() => {
    if (!user?.id) return true;
    const last = messages[messages.length - 1];
    if (!last) return true;
    return last.sender.id !== user.id;
  }, [messages, user?.id]);
  const rankedCharacterRole =
    rankedStatus.status === "matched" ? rankedStatus.characterRole ?? null : null;
  const isMatched = rankedStatus.status === "matched";
  const currentTurnUserId = isMatched ? rankedStatus.currentTurnUserId ?? null : null;
  const isJudge = isMatched ? rankedStatus.isJudge ?? false : false;
  const isMyTurn = isMatched
    ? !isJudge &&
      (currentTurnUserId
        ? currentTurnUserId === user?.id
        : rankedStatus.isMyTurn ?? derivedIsMyTurn)
    : false;
  const activeMatchId = isMatched ? rankedStatus.matchId : null;
  const opponentLives = lives?.opponents ?? [];
  const hasOpponentLost = opponentLives.some((life) => life <= 0);
  const isMatchOver =
    hasMatchEnded || isTimeout || (isMatched && ((lives?.me ?? 1) <= 0 || hasOpponentLost));
  const isTypingTestActive = typingTest.state !== "idle";
  const isTypingTestCountdown = typingTest.state === "countdown";
  const isTypingTestResult = typingTest.state === "result";
  const isTypingTestRunning = typingTest.state === "active";
  const showTypingModal = isTypingTestCountdown || isTypingTestResult;
  const showTypingTestArena = isTypingTestRunning;
  const icebreakerQuestion =
    rankedStatus.status === "matched" ? rankedStatus.icebreakerQuestion : null;
  const cleanedIcebreaker = icebreakerQuestion?.trim();
  const characterRole = rankedCharacterRole;
  const characterRoleAssignedAt =
    rankedStatus.status === "matched" ? rankedStatus.characterRoleAssignedAt : null;
  const roundNumber = (typingTest.round ?? 0) + 1;
  const matchStateMessage =
    rankedStatus.status === "matched"
      ? isMatchOver
        ? "Match over."
        : isTypingTestActive
          ? "Typing test in progress."
          : roundNumber % 2 === 1
            ? cleanedIcebreaker || "Start the conversation."
            : isMyTurn
              ? "Your Move."
              : cleanedIcebreaker || "Start the conversation."
      : "";
  const matchStateTone = isMatchOver
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-card-border/70 bg-white/80 text-muted";
  const showCenterPanel =
    (rankedStatus.status !== "matched" || isMatchOver) && !showTypingModal;
  const matchSnapshot = !isMatched && hasMatchEnded ? lastMatchSnapshot : null;
  const showMatchSnapshot = Boolean(matchSnapshot);
  const displayLives = isMatched
    ? lives ?? { me: 3, opponents: [3, 3] }
    : matchSnapshot
      ? matchSnapshot.lives
      : null;
  const displayOpponents = isMatched
    ? rankedStatus.opponents
    : matchSnapshot
      ? matchSnapshot.opponents
      : [];
  const displayJudgeUserId = isMatched
    ? rankedStatus.judgeUserId ?? null
    : matchSnapshot
      ? matchSnapshot.judgeUserId
      : null;
  const displayIsJudge = isMatched ? isJudge : matchSnapshot?.isJudge ?? false;
  const isJudgeOddRound = displayIsJudge && roundNumber % 2 === 1;
  const opponentLivesById = useMemo(() => {
    const mapping = new Map<string, number>();
    displayOpponents.forEach((opponent, index) => {
      mapping.set(opponent.id, displayLives?.opponents?.[index] ?? 3);
    });
    return mapping;
  }, [displayOpponents, displayLives?.opponents]);
  const [leftOpponent, rightOpponent] = useMemo(() => {
    if (displayOpponents.length === 0) {
      return [null, null] as const;
    }
    if (displayJudgeUserId && !displayIsJudge) {
      const judgeOpponent =
        displayOpponents.find((opponent) => opponent.id === displayJudgeUserId) ??
        displayOpponents[0];
      const otherOpponent =
        displayOpponents.find((opponent) => opponent.id !== judgeOpponent.id) ??
        displayOpponents[1] ??
        null;
      return [judgeOpponent, otherOpponent] as const;
    }
    return [displayOpponents[0] ?? null, displayOpponents[1] ?? null] as const;
  }, [displayOpponents, displayIsJudge, displayJudgeUserId]);
  const didWin =
    isMatchOver &&
    !displayIsJudge &&
    (displayLives?.me ?? 0) > 0 &&
    (displayLives?.opponents?.some((life) => life <= 0) ?? false);
  const matchModalTitle = isMatchOver
    ? displayIsJudge
      ? "Match Complete"
      : didWin
        ? "You Won"
        : "You Lose"
    : rankedStatus.status === "waiting"
      ? "Searching for players..."
      : "Ready To Play";
  const matchModalBody = isMatchOver
    ? "Start a new match when you're ready."
    : rankedStatus.status === "waiting"
      ? "Stay here - we will drop you into the chat once matched."
      : "Press play to get paired with someone new.";
  const matchModalActionLabel = isMatchOver
    ? "Play Again"
    : rankedStatus.status === "waiting"
      ? "Cancel"
      : "Play";
  const myName = user?.name ?? "You";
  const myHandle = user?.handle ?? "you";
  const isAdmin = Boolean(user?.isAdmin);
  const myLivesCount = displayLives?.me ?? 3;
  const leftOpponentName = leftOpponent?.name ?? "Waiting for a match";
  const leftOpponentHandle = leftOpponent?.handle ?? "Queue up to play.";
  const leftOpponentProfileHref = leftOpponent?.handle
    ? `/profile/${encodeURIComponent(leftOpponent.handle.replace(/^@/, ""))}`
    : null;
  const rightOpponentName = rightOpponent?.name ?? "Waiting for a match";
  const rightOpponentHandle = rightOpponent?.handle ?? "Queue up to play.";
  const rightOpponentProfileHref = rightOpponent?.handle
    ? `/profile/${encodeURIComponent(rightOpponent.handle.replace(/^@/, ""))}`
    : null;
  const leftOpponentLivesCount = leftOpponent
    ? opponentLivesById.get(leftOpponent.id) ?? 3
    : 3;
  const rightOpponentLivesCount = rightOpponent
    ? opponentLivesById.get(rightOpponent.id) ?? 3
    : 3;
  const chatOpponent =
    !displayIsJudge
      ? displayOpponents.find((opponent) => opponent.id !== displayJudgeUserId) ??
        displayOpponents[0] ??
        null
      : displayOpponents[0] ?? null;
  const messageColorById = useMemo(() => {
    const palette = [
      "bg-accent text-white",
      "bg-emerald-500 text-white",
      "bg-sky-500 text-white",
      "bg-violet-500 text-white",
    ];
    const ids = [user?.id, ...displayOpponents.map((opponent) => opponent.id)].filter(
      Boolean
    ) as string[];
    const mapping = new Map<string, string>();
    ids.forEach((id, index) => {
      mapping.set(id, palette[index % palette.length]);
    });
    return mapping;
  }, [displayOpponents, user?.id]);
  const renderHearts = (filledCount: number, alignRight = false) => (
    <div className={`flex items-center gap-1 ${alignRight ? "justify-end" : ""}`}>
      {Array.from({ length: 3 }).map((_, index) => {
        const filled = index < filledCount;
        return (
          <svg
            key={`heart-${index}`}
            viewBox="0 0 24 24"
            className={`h-4 w-4 ${filled ? "text-rose-500" : "text-rose-200"}`}
            fill={filled ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.8"
            aria-hidden="true"
          >
            <path d="M12 21s-6.7-4.35-9.2-7.28C.9 11.6 1.2 8.4 3.7 6.8c1.8-1.1 4.1-.8 5.5.8L12 10.4l2.8-2.8c1.4-1.6 3.7-1.9 5.5-.8 2.5 1.6 2.8 4.8.9 6.9C18.7 16.7 12 21 12 21z" />
          </svg>
        );
      })}
    </div>
  );
  const getTimerBarClass = (active: boolean, seconds: number) => {
    if (!active) {
      return "bg-slate-300";
    }
    return seconds <= 5 ? "bg-amber-500" : "bg-emerald-500";
  };
  const renderTimerBar = (seconds: number, active: boolean, alignRight = false) => {
    const progress = Math.max(0, Math.min(1, seconds / TURN_SECONDS));
    return (
      <div className={`w-24 ${alignRight ? "ml-auto" : ""}`}>
        <div className="h-2 w-full overflow-hidden rounded-full bg-card-border/60">
          <div
            className={`h-full transition-[width] duration-300 ${getTimerBarClass(
              active,
              seconds
            )}`}
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    );
  };
  const getModalProgress = (startedAt: string | undefined, durationSeconds: number) => {
    if (!startedAt) {
      return 0;
    }
    const startedMs = Date.parse(startedAt);
    if (!Number.isFinite(startedMs)) {
      return 0;
    }
    const nowMs = Date.now() - serverTimeOffsetRef.current;
    const elapsed = Math.max(0, nowMs - startedMs);
    return Math.min(1, elapsed / (durationSeconds * 1000));
  };
  const typingModalProgress = useMemo(() => {
    if (isTypingTestCountdown) {
      return getModalProgress(typingTest.startedAt, TYPING_TEST_MODAL_SECONDS);
    }
    if (isTypingTestResult) {
      return getModalProgress(typingTest.resultAt, TYPING_TEST_MODAL_SECONDS);
    }
    return 0;
  }, [isTypingTestCountdown, isTypingTestResult, typingModalTick, typingTest.resultAt, typingTest.startedAt]);
  const roleModalProgress = useMemo(() => {
    if (roleModalStartMs === null) {
      return 0;
    }
    const elapsed = Date.now() - roleModalStartMs;
    return Math.min(1, elapsed / (ROLE_MODAL_SECONDS * 1000));
  }, [roleModalStartMs, roleModalTick]);
  const isRoleModalActive = useMemo(() => {
    if (roleModalStartMs === null) {
      return false;
    }
    return Date.now() - roleModalStartMs < ROLE_MODAL_SECONDS * 1000;
  }, [roleModalStartMs, roleModalTick]);
  const showRoleModal = isRoleModalActive;
  const showBlockingModal = showTypingModal || showRoleModal;
  const showStatusBar =
    rankedStatus.status === "matched" &&
    !showCenterPanel &&
    !showBlockingModal &&
    !showTypingTestArena;
  const isTurnBlocked = isTypingTestActive || isRoleModalActive;
  const isTurnExpired =
    isMatched &&
    isMyTurn &&
    timeLeft <= 0 &&
    !isMatchOver &&
    !isTypingTestActive &&
    !isRoleModalActive;
  const canTypeMessage =
    rankedStatus.status === "matched" &&
    !isMatchOver &&
    !isTurnBlocked &&
    !isTurnExpired &&
    (displayIsJudge ? !isJudgeOddRound : isMyTurn);
  const canSendMessage =
    rankedStatus.status === "matched" &&
    !isMatchOver &&
    !isTurnBlocked &&
    !isTurnExpired &&
    (displayIsJudge ? !isJudgeOddRound : isMyTurn && !justSentRef.current);
  const showSmiteButton =
    isAdmin && isMatched && !isMatchOver && !isTypingTestActive && !isRoleModalActive;
  const typingWordsText =
    typingTest.words.length > 0 ? typingTest.words.join(" ") : "Loading words...";
  const typingTestDisabled = displayIsJudge;
  const typingWinnerName =
    typingTest.winnerId && typingTest.winnerId !== user?.id
      ? displayOpponents.find((opponent) => opponent.id === typingTest.winnerId)
          ?.name ?? "Opponent"
      : "You";
  const typingResultTitle = typingTest.winnerId
    ? typingTest.winnerId === user?.id
      ? "You won the typing test!"
      : `${typingWinnerName} won the typing test`
    : "Typing test finished";
  const getRemainingSeconds = useCallback((turnStartedAt: string) => {
    const startedMs = Date.parse(turnStartedAt);
    if (!Number.isFinite(startedMs)) {
      return TURN_SECONDS;
    }
    const nowMs = Date.now() - serverTimeOffsetRef.current;
    const remainingMs = TURN_SECONDS * 1000 - (nowMs - startedMs);
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }, []);
  const showTimerSnapshot = isMatched || !!showMatchSnapshot;
  const activeTurnSeconds = showTimerSnapshot
    ? isTurnBlocked
      ? TURN_SECONDS
      : timeLeft
    : TURN_SECONDS;
  const getTimerSecondsForUser = (id?: string | null) => {
    if (!id || !showTimerSnapshot) {
      return TURN_SECONDS;
    }
    if (!currentTurnUserId || isTurnBlocked || isMatchOver) {
      return TURN_SECONDS;
    }
    return currentTurnUserId === id ? activeTurnSeconds : TURN_SECONDS;
  };
  const isTimerActiveForUser = (id?: string | null) =>
    isMatched && !isMatchOver && !isTurnBlocked && !!id && currentTurnUserId === id;
  const syncTimer = useCallback(
    (turnStartedAt: string | null, serverTime?: string, timedOut?: boolean) => {
      if (!turnStartedAt) {
        return;
      }
      if (serverTime) {
        const serverMs = Date.parse(serverTime);
        if (Number.isFinite(serverMs)) {
          serverTimeOffsetRef.current = Date.now() - serverMs;
        }
      }
      turnStartedAtRef.current = turnStartedAt;
      if (timedOut) {
        setTimeLeft(0);
        setIsTimeout(true);
        return;
      }
      const remainingSeconds = getRemainingSeconds(turnStartedAt);
      setTimeLeft(remainingSeconds);
      setIsTimeout(false);
    },
    [getRemainingSeconds]
  );

  useEffect(() => {
    if (!user?.id) {
      justSentRef.current = false;
      return;
    }
    const last = messages[messages.length - 1];
    if (!last) {
      justSentRef.current = false;
      return;
    }
    justSentRef.current = last.sender.id === user.id;
  }, [messages, user?.id]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && ["c", "v", "x"].includes(key)) {
        event.preventDefault();
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Escape" && selectedMessageId) {
        setSelectedMessageId(null);
      }
    };
    const blockClipboard = (event: Event) => {
      event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("copy", blockClipboard);
    window.addEventListener("cut", blockClipboard);
    window.addEventListener("paste", blockClipboard);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("copy", blockClipboard);
      window.removeEventListener("cut", blockClipboard);
      window.removeEventListener("paste", blockClipboard);
    };
  }, [selectedMessageId]);

  useEffect(() => {
    if (typingTest.state === "idle") {
      typingRoundRef.current = null;
      return;
    }
    const round = typingTest.round ?? 0;
    if (typingRoundRef.current !== round) {
      typingRoundRef.current = round;
      setTypingAttempt("");
      setTypingTestError(null);
    }
  }, [typingTest.round, typingTest.state]);

  useEffect(() => {
    if (rankedStatus.status !== "matched" || !activeMatchId) {
      setRoleModalStartMs(null);
      return;
    }
    maybeStartRoleModal(activeMatchId);
  }, [activeMatchId, characterRole, maybeStartRoleModal, rankedStatus.status]);

  useEffect(() => {
    if (!isTypingTestCountdown && !isTypingTestResult) {
      return;
    }
    const interval = window.setInterval(() => {
      setTypingModalTick(Date.now());
    }, 100);
    return () => window.clearInterval(interval);
  }, [isTypingTestCountdown, isTypingTestResult]);

  useEffect(() => {
    if (roleModalStartMs === null) {
      return;
    }
    const remainingMs = ROLE_MODAL_SECONDS * 1000 - (Date.now() - roleModalStartMs);
    if (remainingMs <= 0) {
      return;
    }
    const interval = window.setInterval(() => {
      setRoleModalTick(Date.now());
    }, 100);
    const timeout = window.setTimeout(() => {
      window.clearInterval(interval);
      setRoleModalTick(Date.now());
    }, remainingMs + 50);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(timeout);
    };
  }, [roleModalStartMs]);

  useEffect(() => {
    if (rankedStatus.status === "matched") {
      setLastMatchSnapshot({
        opponents: rankedStatus.opponents,
        lives: rankedStatus.lives ?? { me: 3, opponents: [3, 3] },
        judgeUserId: rankedStatus.judgeUserId ?? null,
        isJudge: rankedStatus.isJudge ?? false,
      });
    }
  }, [rankedStatus]);

  const loadStatus = useCallback(async () => {
    if (!token) {
      setRankedStatus({ status: "idle" });
      return;
    }

    try {
      const status = await apiGet<RankedStatus>("/ranked/status", token);
      setRankedStatus(status);
      if (status.status === "matched") {
        maybeStartRoleModal(status.matchId);
        if (status.serverTime) {
          const serverMs = Date.parse(status.serverTime);
          if (Number.isFinite(serverMs)) {
            serverTimeOffsetRef.current = Date.now() - serverMs;
          }
        }
        if (status.turnStartedAt) {
          turnStartedAtRef.current = status.turnStartedAt;
        }
        const matchOver =
          (status.lives?.me ?? 1) <= 0 ||
          (status.lives?.opponents?.some((life) => life <= 0) ?? false);
        if (matchOver) {
          setHasMatchEnded(true);
        }
        if (matchOver) {
          setIsTimeout(true);
        } else if (!hasMatchEnded) {
          setIsTimeout(false);
        }
        if (status.turnStartedAt) {
          syncTimer(status.turnStartedAt, status.serverTime, matchOver);
        } else {
          setTimeLeft(TURN_SECONDS);
        }
      }
    } catch (error) {
      console.error("Ranked status error", error);
      setQueueError(error instanceof Error ? error.message : "Unable to load status.");
    }
  }, [hasMatchEnded, maybeStartRoleModal, syncTimer, token]);

  const loadMessages = useCallback(async () => {
    if (!token || !activeMatchId) {
      return;
    }
    if (isLoadingMessagesRef.current) {
      return;
    }
    isLoadingMessagesRef.current = true;
    if (!hasLoadedMessagesRef.current) {
      setIsChatLoading(true);
    }
    setChatError(null);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const payload = await apiGet<{
        messages: RankedMessage[];
        timedOut: boolean;
        turnStartedAt: string;
        serverTime: string;
        isMyTurn: boolean;
        currentTurnUserId?: string | null;
        isJudge?: boolean;
        judgeUserId?: string | null;
        lives?: { me: number; opponents: number[] };
        typing?: string;
        typingTest?: TypingTestPayload;
        icebreakerQuestion?: string | null;
        characterRole?: string | null;
        characterRoleAssignedAt?: string | null;
      }>(`/ranked/match/${encodeURIComponent(activeMatchId)}/messages`, token, {
        signal: controller.signal,
      });
      if (payload.serverTime) {
        const serverMs = Date.parse(payload.serverTime);
        if (Number.isFinite(serverMs)) {
          serverTimeOffsetRef.current = Date.now() - serverMs;
        }
      }
      if (payload.turnStartedAt) {
        turnStartedAtRef.current = payload.turnStartedAt;
      }
      setRankedStatus((prev) =>
        prev.status === "matched"
          ? {
              ...prev,
              isMyTurn: payload.isMyTurn ?? prev.isMyTurn,
              currentTurnUserId: payload.currentTurnUserId ?? prev.currentTurnUserId,
              isJudge: payload.isJudge ?? prev.isJudge,
              judgeUserId: payload.judgeUserId ?? prev.judgeUserId,
              lives: payload.lives ?? prev.lives,
              turnStartedAt: payload.turnStartedAt ?? prev.turnStartedAt,
              serverTime: payload.serverTime ?? prev.serverTime,
              icebreakerQuestion:
                payload.icebreakerQuestion ?? prev.icebreakerQuestion ?? null,
              characterRole: payload.characterRole ?? prev.characterRole ?? null,
              characterRoleAssignedAt:
                payload.characterRoleAssignedAt ?? prev.characterRoleAssignedAt ?? null,
            }
          : prev
      );
      maybeStartRoleModal(activeMatchId);
      const matchOver =
        payload.timedOut ||
        (payload.lives?.me ?? 1) <= 0 ||
        (payload.lives?.opponents?.some((life) => life <= 0) ?? false);
      if (matchOver) {
        setHasMatchEnded(true);
      }
      const nextTypingTest = payload.typingTest ?? { state: "idle", words: [] };
      setTypingTest(nextTypingTest);
      if (nextTypingTest.state !== "idle") {
        setTimeLeft(TURN_SECONDS);
        setIsTimeout(false);
      } else if (matchOver) {
        setIsTimeout(true);
        setTimeLeft(TURN_SECONDS);
      } else if (!hasMatchEnded) {
        setIsTimeout(false);
        if (payload.turnStartedAt) {
          syncTimer(payload.turnStartedAt, payload.serverTime, payload.timedOut);
        } else {
          setTimeLeft(TURN_SECONDS);
        }
      }
      setMessages(payload.messages);
      setOpponentTyping(payload.typing ?? "");
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        setChatError("Chat sync timed out. Retrying...");
      } else {
        setChatError(
          error instanceof Error ? error.message : "Unable to load matched chat."
        );
      }
      setMessages([]);
      setOpponentTyping("");
      setTypingTest({ state: "idle", words: [] });
    } finally {
      window.clearTimeout(timeout);
      setIsChatLoading(false);
      hasLoadedMessagesRef.current = true;
      isLoadingMessagesRef.current = false;
    }
  }, [activeMatchId, hasMatchEnded, maybeStartRoleModal, rankedStatus.status, syncTimer, token]);

  const sendTypingUpdate = useCallback(
    async (text: string) => {
      if (!token || rankedStatus.status !== "matched" || !activeMatchId) {
        return;
      }
      if (text === lastTypingSentRef.current) {
        return;
      }
      const previous = lastTypingSentRef.current;
      lastTypingSentRef.current = text;
      try {
        await apiPatch(
          `/ranked/match/${encodeURIComponent(activeMatchId)}/typing`,
          { body: text },
          token
        );
      } catch {
        lastTypingSentRef.current = previous;
        // Ignore typing sync failures.
      }
    },
    [activeMatchId, rankedStatus.status, token]
  );

  useEffect(() => {
    if (!token) {
      return;
    }
    loadStatus();
  }, [loadStatus, token]);

  useEffect(() => {
    if (rankedStatus.status !== "waiting") {
      return;
    }

    const interval = window.setInterval(loadStatus, 3000);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadStatus, rankedStatus.status]);

  useEffect(() => {
    if (!token || rankedStatus.status !== "matched" || !activeMatchId) {
      return;
    }
    const canType =
      !isMatchOver &&
      !isTurnExpired &&
      !isTurnBlocked &&
      (displayIsJudge ? !isJudgeOddRound : isMyTurn);
    const nextText = canType ? draft : "";

    if (typingDebounceRef.current) {
      window.clearTimeout(typingDebounceRef.current);
    }

    if (!nextText.trim()) {
      sendTypingUpdate("");
      return;
    }

    typingDebounceRef.current = window.setTimeout(() => {
      sendTypingUpdate(nextText);
    }, 250);

    return () => {
      if (typingDebounceRef.current) {
        window.clearTimeout(typingDebounceRef.current);
      }
    };
  }, [
    activeMatchId,
    draft,
    displayIsJudge,
    isJudgeOddRound,
    isMyTurn,
    isMatchOver,
    isTurnBlocked,
    isTurnExpired,
    rankedStatus.status,
    sendTypingUpdate,
    token,
  ]);

  useEffect(() => {
    if (rankedStatus.status !== "matched" || !activeMatchId) {
      activeMatchIdRef.current = null;
      setMessages([]);
      setSavedAt(null);
      setIsTimeout(false);
      if (!hasMatchEnded) {
        setTimeLeft(TURN_SECONDS);
      }
      turnTimeoutReportedRef.current = null;
      setOpponentTyping("");
      setTypingTest({ state: "idle", words: [] });
      setTypingAttempt("");
      setTypingTestError(null);
      hasLoadedMessagesRef.current = false;
      justSentRef.current = false;
      setChatError(null);
      turnStartedAtRef.current = null;
      lastTypingSentRef.current = "";
      return;
    }

    if (activeMatchIdRef.current !== activeMatchId) {
      activeMatchIdRef.current = activeMatchId;
      setMessages([]);
      setDraft("");
      setSavedAt(null);
      setIsTimeout(false);
      setTimeLeft(TURN_SECONDS);
      setHasMatchEnded(false);
      turnTimeoutReportedRef.current = null;
      setOpponentTyping("");
      setTypingTest({ state: "idle", words: [] });
      setTypingAttempt("");
      setTypingTestError(null);
      hasLoadedMessagesRef.current = false;
      justSentRef.current = false;
      setChatError(null);
      lastTypingSentRef.current = "";
    }

    if (isTurnBlocked) {
      setTimeLeft(TURN_SECONDS);
      return;
    }

    turnStartedAtRef.current = rankedStatus.turnStartedAt ?? null;
    if (rankedStatus.turnStartedAt) {
      const matchOver =
        (rankedStatus.lives?.me ?? 1) <= 0 ||
        (rankedStatus.lives?.opponents?.some((life) => life <= 0) ?? false) ||
        hasMatchEnded;
      if (matchOver) {
        setIsTimeout(true);
        setTimeLeft(TURN_SECONDS);
      } else {
        setIsTimeout(false);
        syncTimer(rankedStatus.turnStartedAt, rankedStatus.serverTime);
      }
    }
    if (!isMatchOver) {
      loadMessages();
    }
  }, [
    activeMatchId,
    loadMessages,
    isMatchOver,
    hasMatchEnded,
    isTurnBlocked,
    rankedStatus.status === "matched" ? rankedStatus.lives : undefined,
    rankedStatus.status === "matched" ? rankedStatus.serverTime : undefined,
    rankedStatus.status,
    rankedStatus.status === "matched" ? rankedStatus.turnStartedAt : undefined,
    syncTimer,
  ]);

  useEffect(() => {
    if (
      !activeMatchId ||
      rankedStatus.status !== "matched" ||
      (isMatchOver && typingTest.state === "idle")
    ) {
      return;
    }
    const interval = window.setInterval(loadMessages, 1000);
    return () => window.clearInterval(interval);
  }, [activeMatchId, isMatchOver, loadMessages, rankedStatus.status, typingTest.state]);

  useEffect(() => {
    if (messages.length <= 1) {
      listRef.current?.scrollTo({ top: 0 });
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const canFocus = canTypeMessage && !isSending && !isChatLoading;
    if (canFocus) {
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    }
  }, [
    canTypeMessage,
    isSending,
    isChatLoading,
    timeLeft,
  ]);

  const handlePlay = async () => {
    if (!token) {
      openAuthModal("signup");
      return;
    }
    setHasMatchEnded(false);
    setLastMatchSnapshot(null);
    setIsTimeout(false);
    setTypingTest({ state: "idle", words: [] });
    setTypingAttempt("");
    setTypingTestError(null);
    setIsQueuing(true);
    setQueueError(null);
    try {
      const status = await apiPost<RankedStatus>("/ranked/play", {}, token);
      setRankedStatus(status);
      if (status.status === "matched") {
        maybeStartRoleModal(status.matchId);
        const matchOver =
          (status.lives?.me ?? 1) <= 0 ||
          (status.lives?.opponents?.some((life) => life <= 0) ?? false);
        if (matchOver) {
          setIsTimeout(true);
          setTimeLeft(TURN_SECONDS);
        } else {
          setIsTimeout(false);
          if (status.turnStartedAt) {
            syncTimer(status.turnStartedAt, status.serverTime);
          } else {
            setTimeLeft(TURN_SECONDS);
          }
        }
      }
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to join queue.");
    } finally {
      setIsQueuing(false);
    }
  };

  const handleCancel = async () => {
    if (!token) {
      openAuthModal("signup");
      return;
    }
    setHasMatchEnded(false);
    setLastMatchSnapshot(null);
    setTypingTest({ state: "idle", words: [] });
    setTypingAttempt("");
    setTypingTestError(null);
    setIsQueuing(true);
    setQueueError(null);
    try {
      await apiPost("/ranked/cancel", {}, token);
      setRankedStatus({ status: "idle" });
      setMessages([]);
      setSavedAt(null);
    } catch (error) {
      setQueueError(error instanceof Error ? error.message : "Unable to cancel queue.");
    } finally {
      setIsQueuing(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token) {
      openAuthModal("login");
      return;
    }
    if (isTurnBlocked) {
      setChatError(
        isTypingTestActive ? "Typing test in progress." : "Round starting."
      );
      return;
    }
    if (isMatchOver) {
      setChatError("Match is over.");
      return;
    }
    if (displayIsJudge) {
      if (isJudgeOddRound) {
        setChatError("Judges sit out odd rounds.");
        return;
      }
    } else {
      if (!isMyTurn || justSentRef.current) {
        setChatError("Wait for your opponent to reply before sending again.");
        return;
      }
      if (isTurnExpired) {
        setChatError("Your turn expired. Waiting for your opponent.");
        reportTurnTimeout();
        sendTypingUpdate("");
        return;
      }
    }
    if (rankedStatus.status !== "matched") {
      setChatError("You need a match before chatting.");
      return;
    }
    const trimmed = draft.trim();
    if (!trimmed) {
      setChatError("Write something first.");
      return;
    }
    setIsSending(true);
    setChatError(null);
    try {
      const response = await apiPost<{ message: RankedMessage }>(
        `/ranked/match/${encodeURIComponent(rankedStatus.matchId)}/messages`,
        { body: trimmed },
        token
      );
      setMessages((prev) => [...prev, response.message]);
      setDraft("");
      sendTypingUpdate("");
      if (!displayIsJudge) {
        setRankedStatus((prev) =>
          prev.status === "matched"
            ? {
                ...prev,
                isMyTurn: false,
                currentTurnUserId:
                  prev.opponents.find((opponent) => opponent.id !== prev.judgeUserId)
                    ?.id ?? prev.currentTurnUserId,
              }
            : prev
        );
      }
      setTimeLeft(TURN_SECONDS);
      setIsTimeout(false);
      justSentRef.current = true;
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to send message."
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleEnterToSend = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isComposing =
      (event.nativeEvent as unknown as { isComposing?: boolean })?.isComposing ?? false;
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !isComposing &&
      canSendMessage &&
      !isSending &&
      !isChatLoading
    ) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  const handleSave = async () => {
    if (!token || rankedStatus.status !== "matched") {
      return;
    }
    setIsSaving(true);
    setChatError(null);
    try {
      const payload = await apiPost<{ savedAt: string }>(
        `/ranked/match/${encodeURIComponent(rankedStatus.matchId)}/save`,
        {},
        token
      );
      setSavedAt(String(payload.savedAt));
    } catch (error) {
      setChatError(error instanceof Error ? error.message : "Unable to save chat.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSmite = async () => {
    if (!token || !activeMatchId) {
      return;
    }
    setIsSmiting(true);
    setChatError(null);
    try {
      await apiPost(
        `/ranked/match/${encodeURIComponent(activeMatchId)}/smite`,
        {},
        token
      );
      await loadMessages();
      await loadStatus();
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to smite opponent."
      );
    } finally {
      setIsSmiting(false);
    }
  };

  const handleTypingTestSubmit = async (
    event?: FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>
  ) => {
    event?.preventDefault();
    if (!token || rankedStatus.status !== "matched" || !activeMatchId) {
      return;
    }
    if (!typingAttempt.trim()) {
      setTypingTestError("Type the words to submit.");
      return;
    }
    setIsTypingSubmitting(true);
    setTypingTestError(null);
    try {
      await apiPost(
        `/ranked/match/${encodeURIComponent(activeMatchId)}/typing-test`,
        { attempt: typingAttempt },
        token
      );
      loadMessages();
    } catch (error) {
      setTypingTestError(
        error instanceof Error ? error.message : "Unable to submit typing test."
      );
    } finally {
      setIsTypingSubmitting(false);
    }
  };

  const handleTypingAttemptKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleTypingTestSubmit();
    }
  };


  const reportTurnTimeout = useCallback(async () => {
    if (!token || rankedStatus.status !== "matched" || !activeMatchId) {
      return;
    }
    const turnStartedAt = turnStartedAtRef.current;
    if (!turnStartedAt) {
      return;
    }
    if (turnTimeoutReportedRef.current === turnStartedAt) {
      return;
    }
    turnTimeoutReportedRef.current = turnStartedAt;
    try {
      await apiPost(
        `/ranked/match/${encodeURIComponent(activeMatchId)}/timeout`,
        {},
        token
      );
    } catch {
      // swallow timeout reporting errors
    }
  }, [activeMatchId, rankedStatus.status, token]);

  useEffect(() => {
    if (rankedStatus.status !== "matched") {
      return;
    }
    const timer = window.setInterval(() => {
      if (isTurnBlocked) {
        setTimeLeft(TURN_SECONDS);
        return;
      }
      if (!turnStartedAtRef.current || isMatchOver) {
        return;
      }
      const remainingSeconds = getRemainingSeconds(turnStartedAtRef.current);
      setTimeLeft(remainingSeconds);
      if (remainingSeconds <= 0) {
        reportTurnTimeout();
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    getRemainingSeconds,
    isMatchOver,
    isTurnBlocked,
    rankedStatus.status,
    reportTurnTimeout,
  ]);

  return (
    <div className="mx-auto h-[calc(100vh-80px)] max-w-6xl overflow-hidden px-4 pb-6 pt-6">
      <Card className="relative grid h-full min-h-[520px] grid-rows-[auto_1fr_auto] gap-3 overflow-hidden border border-card-border/70 bg-white/85 shadow-sm">
        <div className="flex flex-col gap-4">
          <div className="grid gap-6 md:grid-cols-[1fr_auto_1fr]">
            <div className="flex min-w-[240px] items-center gap-3 md:justify-self-start">
              {leftOpponent ? (
                leftOpponentProfileHref ? (
                  <Link
                    href={leftOpponentProfileHref}
                    className="rounded-full transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <Avatar name={leftOpponentName} size={44} />
                  </Link>
                ) : (
                  <Avatar name={leftOpponentName} size={44} />
                )
              ) : (
                <div className="h-11 w-11 rounded-full bg-card-border/60" />
              )}
              <div className="flex min-w-0 flex-col">
                <div className="flex items-start gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">{leftOpponentName}</p>
                    <p className="text-xs text-muted">{leftOpponentHandle}</p>
                  </div>
                  <div className="mt-[6px] flex flex-col items-start gap-1">
                    {renderHearts(leftOpponentLivesCount)}
                    {renderTimerBar(
                      getTimerSecondsForUser(leftOpponent?.id),
                      isTimerActiveForUser(leftOpponent?.id)
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-col items-center justify-center gap-2">
              {showSmiteButton && (
                <Button
                  variant="outline"
                  className="px-3 py-1 text-xs"
                  onClick={handleSmite}
                  disabled={isSmiting}
                >
                  {isSmiting ? "Smiting..." : "Smite Opp"}
                </Button>
              )}
              <div className="flex min-w-[240px] items-center justify-center gap-3">
                {user?.name ? (
                  <Avatar name={myName} size={44} />
                ) : (
                  <div className="h-11 w-11 rounded-full bg-card-border/60" />
                )}
                <div className="flex min-w-0 flex-col">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{myName}</p>
                      <p className="text-xs text-muted">{myHandle}</p>
                    </div>
                    <div className="mt-[6px] flex flex-col items-start gap-1">
                      {renderHearts(myLivesCount)}
                      {renderTimerBar(
                        getTimerSecondsForUser(user?.id),
                        isTimerActiveForUser(user?.id)
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex min-w-[240px] flex-row-reverse items-center justify-end gap-3 text-right md:justify-self-end">
              {rightOpponent ? (
                rightOpponentProfileHref ? (
                  <Link
                    href={rightOpponentProfileHref}
                    className="rounded-full transition hover:-translate-y-0.5 hover:shadow-sm"
                  >
                    <Avatar name={rightOpponentName} size={44} />
                  </Link>
                ) : (
                  <Avatar name={rightOpponentName} size={44} />
                )
              ) : (
                <div className="h-11 w-11 rounded-full bg-card-border/60" />
              )}
              <div className="flex min-w-0 flex-col items-end">
                <div className="flex flex-row-reverse items-start gap-3">
                  <div className="min-w-0 text-right">
                    <p className="text-sm font-semibold text-ink">{rightOpponentName}</p>
                    <p className="text-xs text-muted">{rightOpponentHandle}</p>
                  </div>
                  <div className="mt-[6px] flex flex-col items-end gap-1">
                    {renderHearts(rightOpponentLivesCount, true)}
                    {renderTimerBar(
                      getTimerSecondsForUser(rightOpponent?.id),
                      isTimerActiveForUser(rightOpponent?.id),
                      true
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!isAuthenticated ? (
          <div className="row-span-2 flex flex-col items-center justify-center space-y-4 text-center">
            <p className="text-base font-semibold text-ink">
              Log in to play ranked conversation.
            </p>
            <p className="text-sm text-muted">
              We need your profile to pair you with someone.
            </p>
            <Button requiresAuth={false} onClick={() => openAuthModal("login")}>
              Log in
            </Button>
          </div>
        ) : (
          <>
            <div className="flex min-h-0 flex-col">
              {queueError && (
                <div className="mb-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
                  {queueError}
                </div>
              )}
              {showStatusBar && (
                <div
                  className={`mb-3 rounded-2xl border px-4 py-2 text-sm font-semibold ${matchStateTone}`}
                >
                  {matchStateMessage || (
                    <span className="text-transparent" aria-hidden="true">
                      .
                    </span>
                  )}
                </div>
              )}
              <div
                ref={listRef}
                className={`min-h-0 flex-1 pr-1 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
                  showBlockingModal
                    ? "relative overflow-hidden"
                    : "relative overflow-hidden"
                }`}
              >
                {!showBlockingModal &&
                  (showCenterPanel ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <p className="text-lg font-semibold text-ink">{matchModalTitle}</p>
                      <p className="mt-2 text-sm text-muted">{matchModalBody}</p>
                      <div className="mt-5 flex justify-center">
                        <button
                          type="button"
                          className="rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(255,134,88,0.25)] transition hover:translate-y-[-1px] disabled:opacity-60"
                          onClick={
                            rankedStatus.status === "waiting"
                              ? handleCancel
                              : handlePlay
                          }
                          disabled={isQueuing}
                        >
                          {matchModalActionLabel}
                        </button>
                      </div>
                    </div>
                  ) : showTypingTestArena ? (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-muted">
                        Typing Test
                      </p>
                      <p className="mt-3 max-w-2xl text-lg font-semibold text-ink">
                        {typingWordsText}
                      </p>
                      <form
                        onSubmit={handleTypingTestSubmit}
                        className="mt-6 flex w-full max-w-2xl flex-col items-center gap-3"
                      >
                        <input
                          type="text"
                          value={typingAttempt}
                          onChange={(event) => setTypingAttempt(event.target.value)}
                          onKeyDown={handleTypingAttemptKeyDown}
                          className="w-full rounded-full border border-card-border/70 bg-white/90 px-5 py-3 text-sm text-ink outline-none transition focus:border-accent/60"
                          placeholder={
                            typingTestDisabled
                              ? "Judges observe the typing test."
                              : "Type the 10 words here"
                          }
                          disabled={typingTestDisabled}
                        />
                        {typingTestError && (
                          <div className="rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent">
                            {typingTestError}
                          </div>
                        )}
                        <Button
                          type="submit"
                          disabled={
                            typingTestDisabled || isTypingSubmitting || !typingAttempt.trim()
                          }
                        >
                          {isTypingSubmitting ? "Submitting..." : "Submit"}
                        </Button>
                      </form>
                    </div>
                  ) : (
                    <>
                      {isChatLoading ? (
                        <p className="text-sm text-muted">Loading chat...</p>
                      ) : messages.length === 0 ? (
                        <div className="space-y-3">
                          {opponentTyping && (
                            <div className="flex justify-start">
                              <div className="max-w-[90%] rounded-2xl border border-dashed border-card-border/70 bg-white/70 px-4 py-2 text-sm italic text-muted opacity-70">
                                {opponentTyping}
                              </div>
                            </div>
                          )}
                          {draft.trim() && (
                            <div className="flex justify-end">
                              <div className="max-w-[90%] rounded-2xl border border-dashed border-card-border/70 bg-white/70 px-4 py-2 text-sm italic text-muted opacity-70">
                                {draft}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {messages.map((message) => {
                            const isMine = message.sender.id === user?.id;
                            const isSelected = selectedMessageId === message.id;
                            const judgeOpponentIndex = displayOpponents.findIndex(
                              (opponent) => opponent.id === message.sender.id
                            );
                            const judgeIsLeft = judgeOpponentIndex === 0;
                            const judgeIsRight = judgeOpponentIndex === 1;
                            const messageTone = displayIsJudge
                              ? isMine
                                ? "bg-accent text-white"
                                : judgeIsLeft
                                  ? "bg-rose-500 text-white"
                                  : "bg-sky-500 text-white"
                              : messageColorById.get(message.sender.id) ??
                                "border border-card-border/70 bg-white/90 text-ink";
                            const messageAlignment = displayIsJudge
                              ? isMine
                                ? "justify-end"
                                : judgeIsLeft
                                  ? "justify-start"
                                  : "justify-end"
                              : isMine
                                ? "justify-end"
                                : "justify-start";
                            return (
                              <div
                                key={message.id}
                                className={`flex ${messageAlignment}`}
                              >
                                <div
                                  onClick={() => setSelectedMessageId(message.id)}
                                  className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm shadow-sm ${messageTone} ${
                                    isSelected ? "ring-2 ring-accent/40" : ""
                                  }`}
                                >
                                  <p className="whitespace-pre-wrap">{message.body}</p>
                                </div>
                              </div>
                            );
                          })}
                          {opponentTyping && (
                            <div className="flex justify-start">
                              <div className="max-w-[90%] rounded-2xl border border-dashed border-card-border/70 bg-white/70 px-4 py-2 text-sm italic text-muted opacity-70">
                                {opponentTyping}
                              </div>
                            </div>
                          )}
                          {draft.trim() && (
                            <div className="flex justify-end">
                              <div className="max-w-[90%] rounded-2xl border border-dashed border-card-border/70 bg-white/70 px-4 py-2 text-sm italic text-muted opacity-70">
                                {draft}
                              </div>
                            </div>
                          )}
                          <div ref={endRef} />
                        </div>
                      )}
                    </>
                  ))}
              </div>
            </div>

            <form
              className="mt-auto space-y-3 border-t border-card-border/60 pt-4"
              onSubmit={handleSubmit}
            >
              <textarea
                className={`${inputClasses} min-h-[90px]`}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleEnterToSend}
                placeholder={
                  rankedStatus.status === "matched"
                    ? displayIsJudge
                      ? "Judging mode."
                      : `Message ${chatOpponent?.handle ?? "your opponent"}`
                    : "Queue up to unlock chat."
                }
                ref={inputRef}
                disabled={
                  rankedStatus.status !== "matched" || isChatLoading || !canTypeMessage
                }
              />
              {chatError && (
                <div className="rounded-2xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent">
                  {chatError}
                </div>
              )}
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">
                  Messages send as {user?.handle || "you"}.
                </p>
                <Button
                  type="submit"
                  disabled={
                    !canSendMessage || isSending || isChatLoading
                  }
                >
                  {isSending
                    ? "Sending..."
                    : rankedStatus.status === "matched"
                      ? "Send"
                      : "Play to chat"}
                  </Button>
                </div>
              </form>
          </>
        )}
        {showBlockingModal && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white px-6 text-center">
            <div className="w-full max-w-md rounded-3xl border border-card-border/70 bg-white px-6 py-5 shadow-sm">
              {showRoleModal ? (
                <>
                  <p className="text-base font-semibold text-ink">
                    {`Round ${roundNumber}: Icebreaker`}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {displayIsJudge
                      ? "You are the judge for this round."
                      : "Get ready to start the conversation."}
                  </p>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-card-border/60">
                    <div
                      className="h-full bg-accent transition-[width] duration-100"
                      style={{ width: `${roleModalProgress * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-ink">
                    {isTypingTestCountdown ? "Typing test incoming" : typingResultTitle}
                  </p>
                  <p className="mt-2 text-xs text-muted">
                    {isTypingTestCountdown
                      ? "Get ready to type the 10 words."
                      : "Returning to the match..."}
                  </p>
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-card-border/60">
                    <div
                      className="h-full bg-accent transition-[width] duration-100"
                      style={{ width: `${typingModalProgress * 100}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      {/* Center panel replaces modal for idle/waiting/match-end states */}
      </Card>
    </div>
  );
}
