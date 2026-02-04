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
  results?: string[];
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
      points?: { me: number; opponents: number[] };
      turnStartedAt?: string;
      serverTime?: string;
      isMyTurn?: boolean;
      currentTurnUserId?: string | null;
      isJudge?: boolean;
      judgeUserId?: string | null;
      roundNumber?: number;
      roundGameType?: string;
      roundPhase?: string;
      roundStartedAt?: string;
      roleAssignments?: Array<{ userId: string; role: string }>;
      icebreakerQuestion?: string | null;
      characterRole?: string | null;
      characterRoleAssignedAt?: string | null;
    };

type PokerClientState = {
  status: "waiting" | "in_hand" | "hand_over" | "busted";
  street: "preflop" | "flop" | "turn" | "river" | "showdown";
  playerChips: number;
  botChips: number;
  pot: number;
  community: string[];
  playerCards: string[];
  botCards: string[];
  dealer: "player" | "bot";
  turn: "player" | "bot";
  currentBet: number;
  playerBet: number;
  botBet: number;
  blinds: { small: number; big: number };
  log: Array<{ id: string; text: string }>;
  winner?: "player" | "bot" | "tie";
  actions?: {
    canCheck: boolean;
    canCall: boolean;
    canRaise: boolean;
    canBet: boolean;
    callAmount: number;
    minRaise: number;
    maxRaise: number;
  };
};

const inputClasses =
  "w-full rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-ink outline-none transition focus:border-accent/60 focus:bg-white";

const TURN_SECONDS = 15;
const TYPING_TEST_MODAL_SECONDS = 3;
const CHAT_ROUND_SECONDS = 60;
const ROLE_MODAL_SECONDS = 5;
const TYPING_TEST_SECONDS = 60;

type ActiveGame = "covo" | "poker";

export default function RankedPlayPage() {
  const { isAuthenticated, token, user, openAuthModal, refreshUser } = useAuth();
  const [activeGame, setActiveGame] = useState<ActiveGame>("covo");
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
  const [typingTestTick, setTypingTestTick] = useState(0);
  const [roundTick, setRoundTick] = useState(0);
  const [roleModalTick, setRoleModalTick] = useState(0);
  const [roleModalStartMs, setRoleModalStartMs] = useState<number | null>(null);
  const [isSmiting, setIsSmiting] = useState(false);
  const [isVoting, setIsVoting] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const turnTimeoutReportedRef = useRef<string | null>(null);
  const hasLoadedMessagesRef = useRef<boolean>(false);
  const isLoadingMessagesRef = useRef<boolean>(false);
  const activeMatchIdRef = useRef<string | null>(null);
  const roleModalKeyRef = useRef<string | null>(null);
  const justSentRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const serverTimeOffsetRef = useRef<number>(0);
  const turnStartedAtRef = useRef<string | null>(null);
  const typingDebounceRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef<string>("");
  const typingRoundRef = useRef<number | null>(null);
  const typingWordsKeyRef = useRef<string>("");
  const [pokerBuyIn, setPokerBuyIn] = useState("");
  const [pokerError, setPokerError] = useState<string | null>(null);
  const [isBuyingIn, setIsBuyingIn] = useState(false);
  const [pokerState, setPokerState] = useState<PokerClientState | null>(null);
  const [isPokerLoading, setIsPokerLoading] = useState(false);
  const [isPokerActing, setIsPokerActing] = useState(false);
  const [pokerRaiseAmount, setPokerRaiseAmount] = useState("");
  const lives =
    rankedStatus.status === "matched"
      ? rankedStatus.lives ?? { me: 3, opponents: [3, 3] }
      : null;
  const maybeStartRoleModal = useCallback((roundKey: string | null) => {
    if (!roundKey) {
      return;
    }
    if (roleModalKeyRef.current === roundKey) {
      return;
    }
    roleModalKeyRef.current = roundKey;
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
  const haveAllOpponentsLost =
    opponentLives.length > 0 && opponentLives.every((life) => life <= 0);
  const isMatchOver =
    hasMatchEnded || isTimeout || (isMatched && haveAllOpponentsLost);
  const isTypingTestActive = typingTest.state !== "idle";
  const isTypingTestCountdown = typingTest.state === "countdown";
  const isTypingTestResult = typingTest.state === "result";
  const isTypingTestRunning = typingTest.state === "active";
  const showTypingModal = isTypingTestCountdown || isTypingTestResult;
  const showTypingTestArena = isTypingTestRunning;
  const typingTestTimeLeft = useMemo(() => {
    if (!isTypingTestActive || !typingTest.startedAt) {
      return null;
    }
    const startedMs = Date.parse(typingTest.startedAt);
    if (!Number.isFinite(startedMs)) {
      return null;
    }
    const nowMs = Date.now() - serverTimeOffsetRef.current;
    const remainingMs = TYPING_TEST_SECONDS * 1000 - (nowMs - startedMs);
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }, [isTypingTestActive, typingTest.startedAt, typingTestTick]);
  const typingTestProgress = useMemo(() => {
    if (typingTestTimeLeft === null) {
      return 0;
    }
    return Math.max(0, Math.min(1, typingTestTimeLeft / TYPING_TEST_SECONDS));
  }, [typingTestTimeLeft]);
  const icebreakerQuestion =
    rankedStatus.status === "matched" ? rankedStatus.icebreakerQuestion : null;
  const cleanedIcebreaker = icebreakerQuestion?.trim();
  const characterRole = rankedCharacterRole;
  const characterRoleAssignedAt =
    rankedStatus.status === "matched" ? rankedStatus.characterRoleAssignedAt : null;
  const roundNumber =
    rankedStatus.status === "matched" ? rankedStatus.roundNumber ?? 1 : 1;
  const roundGameType =
    rankedStatus.status === "matched"
      ? rankedStatus.roundGameType ??
        (roundNumber % 2 === 0 ? "typing_test" : "icebreaker")
      : null;
  const roundPhase =
    rankedStatus.status === "matched"
      ? rankedStatus.roundPhase ??
        (roundGameType === "typing_test" ? "typing_test" : "chat")
      : null;
  const roundStartedAt =
    rankedStatus.status === "matched" ? rankedStatus.roundStartedAt ?? null : null;
  const isIcebreakerRound = roundGameType === "icebreaker";
  const isRolesRound = roundGameType === "roles";
  const isTypingTestRound = roundGameType === "typing_test";
  const isJudgingPhase = roundPhase === "judging";
  const roundTimeLeft = useMemo(() => {
    if (!roundStartedAt) {
      return null;
    }
    if (!isIcebreakerRound && !isRolesRound) {
      return null;
    }
    if (roundPhase !== "chat") {
      return null;
    }
    const startedMs = Date.parse(roundStartedAt);
    if (!Number.isFinite(startedMs)) {
      return null;
    }
    const nowMs = Date.now() - serverTimeOffsetRef.current;
    const remainingMs = CHAT_ROUND_SECONDS * 1000 - (nowMs - startedMs);
    return Math.max(0, Math.ceil(remainingMs / 1000));
  }, [isIcebreakerRound, isRolesRound, roundPhase, roundStartedAt, roundTick]);
  const roundProgress = useMemo(() => {
    if (roundTimeLeft === null) {
      return 0;
    }
    return Math.max(0, Math.min(1, roundTimeLeft / CHAT_ROUND_SECONDS));
  }, [roundTimeLeft]);
  const roleModalKey = useMemo(() => {
    if (
      !isMatched ||
      !activeMatchId ||
      isMatchOver ||
      roundPhase !== "chat" ||
      roundGameType === "typing_test"
    ) {
      return null;
    }
    return `${activeMatchId}:${roundNumber}:${roundGameType}`;
  }, [activeMatchId, isMatchOver, isMatched, roundGameType, roundNumber, roundPhase]);
  const matchStateMessage =
    rankedStatus.status === "matched"
      ? isMatchOver
        ? "Match over."
        : isTypingTestActive
          ? "Typing test in progress."
          : isJudgingPhase
            ? isJudge
              ? "Judge: double-tap a message to vote."
              : "Waiting for the judge's vote."
            : roundNumber % 2 === 1
              ? isIcebreakerRound
                ? cleanedIcebreaker || "Answer the icebreaker."
                : "Stay in character for this round."
              : isMyTurn
                ? "Your Move."
                : "Waiting for your opponent."
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
  const roleAssignments =
    rankedStatus.status === "matched" ? rankedStatus.roleAssignments ?? [] : [];
  const roleByUserId = useMemo(() => {
    const mapping = new Map<string, string>();
    roleAssignments.forEach((assignment) => {
      mapping.set(assignment.userId, assignment.role);
    });
    return mapping;
  }, [roleAssignments]);
  const leftRole = leftOpponent ? roleByUserId.get(leftOpponent.id) ?? null : null;
  const rightRole = rightOpponent ? roleByUserId.get(rightOpponent.id) ?? null : null;
  const didWin =
    isMatchOver &&
    !displayIsJudge &&
    (displayLives?.me ?? 0) > 0 &&
    ((displayLives?.opponents?.length ?? 0) > 0
      ? displayLives?.opponents?.every((life) => life <= 0)
      : false);
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
  const pokerActions = pokerState?.actions;
  const pokerCallAmount = pokerActions?.callAmount ?? 0;
  const pokerCanAct = Boolean(pokerActions);
  const pokerIsPlayerTurn =
    pokerState?.status === "in_hand" && pokerState?.turn === "player";
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
  const renderPokerCard = (card?: string, hidden = false) => {
    const rank = card?.[0] ?? "";
    const suit = card?.[1] ?? "";
    const suitSymbol =
      suit === "H" ? "♥" : suit === "D" ? "♦" : suit === "C" ? "♣" : suit === "S" ? "♠" : "";
    const face = rank === "T" ? "10" : rank;
    const content = hidden ? "🂠" : `${face}${suitSymbol}`.trim();
    const isRed = suit === "H" || suit === "D";
    return (
      <div
        className={`flex h-12 w-9 items-center justify-center rounded-xl border text-sm font-semibold shadow-sm ${
          hidden
            ? "border-ink/70 bg-ink text-white"
            : `border-card-border/70 bg-white ${isRed ? "text-rose-500" : "text-ink"}`
        }`}
      >
        {content}
      </div>
    );
  };
  const getTimerBarClass = (active: boolean, seconds: number) => {
    if (!active) {
      return "bg-slate-300";
    }
    return seconds <= 5 ? "bg-amber-500" : "bg-emerald-500";
  };
  const renderTimerBar = (
    seconds: number,
    active: boolean,
    alignRight = false,
    override?: { className?: string; progress?: number }
  ) => {
    const progress =
      override?.progress ?? Math.max(0, Math.min(1, seconds / TURN_SECONDS));
    return (
      <div className={`w-24 ${alignRight ? "ml-auto" : ""}`}>
        <div className="h-2 w-full overflow-hidden rounded-full bg-card-border/60">
          <div
            className={`h-full transition-[width] duration-300 ${
              override?.className ?? getTimerBarClass(active, seconds)
            }`}
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
  const showRoleModal = isRoleModalActive && !showTypingModal;
  const showBlockingModal = showTypingModal || showRoleModal;
  const showStatusBar =
    rankedStatus.status === "matched" && !showCenterPanel && !showBlockingModal;
  const isTurnBlocked = isTypingTestActive || isRoleModalActive || isJudgingPhase;
  const isPlayerAlive = !isMatched || (lives?.me ?? 1) > 0;
  const isTurnExpired =
    isMatched &&
    isRolesRound &&
    isMyTurn &&
    timeLeft <= 0 &&
    !isMatchOver &&
    !isTypingTestActive &&
    !isRoleModalActive;
  const icebreakerDeadlineMs = useMemo(() => {
    if (!roundStartedAt) {
      return null;
    }
    const parsed = Date.parse(roundStartedAt);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    return parsed + CHAT_ROUND_SECONDS * 1000;
  }, [roundStartedAt]);
  const icebreakerTimeLeft = useMemo(() => {
    if (!icebreakerDeadlineMs) {
      return null;
    }
    return Math.max(0, Math.ceil((icebreakerDeadlineMs - Date.now()) / 1000));
  }, [icebreakerDeadlineMs]);
  const hasAnsweredIcebreaker = useMemo(() => {
    if (!isIcebreakerRound || !roundStartedAt || !user?.id) {
      return false;
    }
    const roundStartMs = Date.parse(roundStartedAt);
    if (!Number.isFinite(roundStartMs)) {
      return false;
    }
    return messages.some((message) => {
      if (message.sender.id !== user.id) {
        return false;
      }
      const createdAtMs = Date.parse(message.createdAt);
      return Number.isFinite(createdAtMs) && createdAtMs >= roundStartMs;
    });
  }, [isIcebreakerRound, messages, roundStartedAt, user?.id]);
  const canTypeMessage =
    rankedStatus.status === "matched" &&
    !isMatchOver &&
    !isTurnBlocked &&
    !isTypingTestRound &&
    !isJudgingPhase &&
    (isIcebreakerRound
      ? !displayIsJudge &&
        isPlayerAlive &&
        !hasAnsweredIcebreaker &&
        (icebreakerTimeLeft ?? 1) > 0
      : isRolesRound
        ? !displayIsJudge && isPlayerAlive && isMyTurn && !isTurnExpired
        : false);
  const canSendMessage =
    rankedStatus.status === "matched" &&
    !isMatchOver &&
    !isTurnBlocked &&
    !isTypingTestRound &&
    !isJudgingPhase &&
    (isIcebreakerRound
      ? !displayIsJudge &&
        isPlayerAlive &&
        !hasAnsweredIcebreaker &&
        (icebreakerTimeLeft ?? 1) > 0
      : isRolesRound
        ? !displayIsJudge &&
          isPlayerAlive &&
          isMyTurn &&
          !isTurnExpired &&
          !justSentRef.current
        : false);
  const showSmiteButton = isAdmin && isMatched && !isMatchOver;
  const typingAttemptWords = useMemo(() => typingAttempt.split(" "), [typingAttempt]);
  const extraTypingWords = useMemo(() => {
    if (typingAttemptWords.length <= typingTest.words.length) {
      return [] as string[];
    }
    return typingAttemptWords
      .slice(typingTest.words.length)
      .filter((word) => word.length > 0);
  }, [typingAttemptWords, typingTest.words.length]);
  const typingTestResults = typingTest.results ?? [];
  const normalizeTypingAttempt = useCallback(
    (value: string) =>
      value
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " "),
    []
  );
  const typingExpected = useMemo(
    () => normalizeTypingAttempt(typingTest.words.join(" ")),
    [normalizeTypingAttempt, typingTest.words]
  );
  const typingAttemptNormalized = useMemo(
    () => normalizeTypingAttempt(typingAttempt),
    [normalizeTypingAttempt, typingAttempt]
  );
  const typingAutoSubmitRef = useRef<string>("");
  const isTypingCompleteForMe = Boolean(
    user?.id && typingTestResults.includes(user.id)
  );
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
  const didOpponentsLose = (value?: { opponents?: number[] }) =>
    (value?.opponents?.length ?? 0) > 0 &&
    value?.opponents?.every((life) => life <= 0);
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
    if (!currentTurnUserId || isTurnBlocked || isMatchOver || !isRolesRound) {
      return TURN_SECONDS;
    }
    return currentTurnUserId === id ? activeTurnSeconds : TURN_SECONDS;
  };
  const isTimerActiveForUser = (id?: string | null) =>
    isMatched &&
    !isMatchOver &&
    !isTurnBlocked &&
    isRolesRound &&
    !!id &&
    currentTurnUserId === id;
  const getTypingTestBarOverride = (id?: string | null) => {
    if (!isTypingTestActive || !id) {
      return null;
    }
    const completed = typingTestResults.includes(id);
    return {
      className: completed ? "bg-emerald-500" : "bg-rose-500",
      progress: 1,
    };
  };
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
      typingAutoSubmitRef.current = "";
      typingWordsKeyRef.current = "";
      return;
    }
    const round = typingTest.round ?? 0;
    if (typingRoundRef.current !== round) {
      typingRoundRef.current = round;
      typingAutoSubmitRef.current = "";
      setTypingAttempt("");
      setTypingTestError(null);
    }
  }, [typingTest.round, typingTest.state]);

  useEffect(() => {
    if (!showTypingTestArena && typingTest.state !== "countdown") {
      return;
    }
    const wordsKey = typingTest.words.join(" ");
    if (typingWordsKeyRef.current === wordsKey) {
      return;
    }
    typingWordsKeyRef.current = wordsKey;
    typingAutoSubmitRef.current = "";
    setTypingAttempt("");
    setTypingTestError(null);
  }, [showTypingTestArena, typingTest.state, typingTest.words]);

  useEffect(() => {
    if (!roleModalKey) {
      setRoleModalStartMs(null);
      return;
    }
    maybeStartRoleModal(roleModalKey);
  }, [maybeStartRoleModal, roleModalKey]);

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
    if (!isTypingTestActive) {
      return;
    }
    const interval = window.setInterval(() => {
      setTypingTestTick(Date.now());
    }, 250);
    return () => window.clearInterval(interval);
  }, [isTypingTestActive]);

  useEffect(() => {
    if (!isMatched) {
      return;
    }
    if (!isIcebreakerRound && !isRolesRound) {
      return;
    }
    if (roundPhase !== "chat") {
      return;
    }
    const interval = window.setInterval(() => {
      setRoundTick(Date.now());
    }, 250);
    return () => window.clearInterval(interval);
  }, [isMatched, isIcebreakerRound, isRolesRound, roundPhase, roundStartedAt]);

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
      setQueueError(null);
      setRankedStatus({ status: "idle" });
      return;
    }

    try {
      const status = await apiGet<RankedStatus>("/ranked/status", token);
      setRankedStatus(status);
      setQueueError(null);
      if (status.status === "matched") {
        if (status.serverTime) {
          const serverMs = Date.parse(status.serverTime);
          if (Number.isFinite(serverMs)) {
            serverTimeOffsetRef.current = Date.now() - serverMs;
          }
        }
        if (status.turnStartedAt) {
          turnStartedAtRef.current = status.turnStartedAt;
        }
        const matchOver = didOpponentsLose(status.lives);
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
  }, [hasMatchEnded, syncTimer, token]);

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
        points?: { me: number; opponents: number[] };
        roundNumber?: number;
        roundGameType?: string;
        roundPhase?: string;
        roundStartedAt?: string;
        roleAssignments?: Array<{ userId: string; role: string }>;
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
              points: payload.points ?? prev.points,
              roundNumber: payload.roundNumber ?? prev.roundNumber,
              roundGameType: payload.roundGameType ?? prev.roundGameType,
              roundPhase: payload.roundPhase ?? prev.roundPhase,
              roundStartedAt: payload.roundStartedAt ?? prev.roundStartedAt,
              roleAssignments: payload.roleAssignments ?? prev.roleAssignments,
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
      const matchOver = payload.timedOut || didOpponentsLose(payload.lives);
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
      setOpponentTyping("");
    } finally {
      window.clearTimeout(timeout);
      setIsChatLoading(false);
      hasLoadedMessagesRef.current = true;
      isLoadingMessagesRef.current = false;
    }
  }, [activeMatchId, hasMatchEnded, rankedStatus.status, syncTimer, token]);

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
    if (rankedStatus.status !== "matched") {
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
    const nextText = canTypeMessage ? draft : "";

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
    canTypeMessage,
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
        didOpponentsLose(rankedStatus.lives) || hasMatchEnded;
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
      setQueueError(null);
      if (status.status === "matched") {
        const matchOver = didOpponentsLose(status.lives);
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

  const loadPokerState = useCallback(async () => {
    if (!token) {
      setPokerState(null);
      setIsPokerLoading(false);
      return;
    }
    setIsPokerLoading(true);
    try {
      const response = await apiGet<{ state: PokerClientState | null }>(
        "/poker/state",
        token
      );
      setPokerState(response.state);
      setPokerError(null);
    } catch (error) {
      setPokerError(
        error instanceof Error ? error.message : "Unable to load poker table."
      );
    } finally {
      setIsPokerLoading(false);
    }
  }, [token]);

  const handlePokerBuyIn = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!token) {
      openAuthModal("login");
      return;
    }
    const amount = Number(pokerBuyIn);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPokerError("Enter a valid buy-in amount.");
      return;
    }
    setPokerError(null);
    setIsBuyingIn(true);
    try {
      const response = await apiPost<{ coins: number; chips: number }>(
        "/poker/buy-in",
        { amount },
        token
      );
      setPokerBuyIn("");
      setPokerRaiseAmount("");
      await loadPokerState();
      await refreshUser();
    } catch (error) {
      setPokerError(
        error instanceof Error ? error.message : "Unable to buy in right now."
      );
    } finally {
      setIsBuyingIn(false);
    }
  };

  const handlePokerStartHand = async () => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    setIsPokerActing(true);
    setPokerError(null);
    try {
      const response = await apiPost<{ state: PokerClientState }>(
        "/poker/start-hand",
        {},
        token
      );
      setPokerState(response.state);
    } catch (error) {
      setPokerError(
        error instanceof Error ? error.message : "Unable to start a hand."
      );
    } finally {
      setIsPokerActing(false);
    }
  };

  const handlePokerAction = async (action: "fold" | "check" | "call" | "bet" | "raise") => {
    if (!token) {
      openAuthModal("login");
      return;
    }
    setIsPokerActing(true);
    setPokerError(null);
    const amount =
      action === "bet" || action === "raise" ? Number(pokerRaiseAmount) : undefined;
    if ((action === "bet" || action === "raise") && (!amount || amount <= 0)) {
      setPokerError("Enter a valid bet amount.");
      setIsPokerActing(false);
      return;
    }
    try {
      const response = await apiPost<{ state: PokerClientState }>(
        "/poker/action",
        { action, amount },
        token
      );
      setPokerState(response.state);
      setPokerRaiseAmount("");
    } catch (error) {
      setPokerError(
        error instanceof Error ? error.message : "Unable to play that action."
      );
    } finally {
      setIsPokerActing(false);
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
    if (isJudgingPhase) {
      setChatError("Waiting for the judge's vote.");
      return;
    }
    if (isTypingTestRound) {
      setChatError("Typing test in progress.");
      return;
    }
    if (isIcebreakerRound) {
      if (displayIsJudge) {
        setChatError("Judges don't answer the icebreaker.");
        return;
      }
      if (hasAnsweredIcebreaker) {
        setChatError("You already answered the icebreaker.");
        return;
      }
      if ((icebreakerTimeLeft ?? 1) <= 0) {
        setChatError("Icebreaker time is up.");
        return;
      }
    }
    if (isRolesRound) {
      if (displayIsJudge) {
        setChatError("Judges don't send chat messages.");
        return;
      }
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

  const handleJudgeVote = async (messageId: string) => {
    if (!token || !activeMatchId || rankedStatus.status !== "matched") {
      return;
    }
    if (!displayIsJudge || !isJudgingPhase) {
      setChatError("Voting is not available right now.");
      return;
    }
    if (!isIcebreakerRound && !isRolesRound) {
      setChatError("This round is not judged.");
      return;
    }
    setIsVoting(true);
    setChatError(null);
    try {
      await apiPost(
        `/ranked/match/${encodeURIComponent(activeMatchId)}/vote`,
        { messageId },
        token
      );
      await loadMessages();
      await loadStatus();
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Unable to submit vote."
      );
    } finally {
      setIsVoting(false);
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

  useEffect(() => {
    if (!showTypingTestArena || isTypingSubmitting || isTypingCompleteForMe) {
      return;
    }
    if (!typingExpected || !typingAttemptNormalized) {
      return;
    }
    if (typingAttemptNormalized !== typingExpected) {
      return;
    }
    if (typingAutoSubmitRef.current === typingAttemptNormalized) {
      return;
    }
    typingAutoSubmitRef.current = typingAttemptNormalized;
    handleTypingTestSubmit();
  }, [
    handleTypingTestSubmit,
    isTypingCompleteForMe,
    isTypingSubmitting,
    showTypingTestArena,
    typingAttemptNormalized,
    typingExpected,
  ]);

  useEffect(() => {
    if (!showTypingTestArena || isTypingCompleteForMe) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      if (isTypingSubmitting) {
        return;
      }
      const key = event.key;
      if (key === "Backspace") {
        event.preventDefault();
        setTypingAttempt((prev) => prev.slice(0, -1));
        return;
      }
      if (key === "Enter" || key === "Tab") {
        event.preventDefault();
        return;
      }
      if (key.length === 1) {
        event.preventDefault();
        setTypingAttempt((prev) => prev + key);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTypingCompleteForMe, isTypingSubmitting, showTypingTestArena]);


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
      if (isTurnBlocked || !isRolesRound) {
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

  useEffect(() => {
    if (activeGame !== "poker") {
      return;
    }
    void loadPokerState();
  }, [activeGame, loadPokerState]);

  return (
    <div className="mx-auto h-[calc(100vh-80px)] max-w-6xl overflow-hidden px-4 pb-6 pt-6 flex flex-col">
      <div className="relative z-10 mb-0 flex flex-wrap items-center gap-3">
        <div className="inline-flex overflow-hidden rounded-t-2xl border border-card-border/70 bg-white/80 shadow-sm">
          <button
            type="button"
            onClick={() => setActiveGame("covo")}
            className={`rounded-tl-2xl border-b border-card-border/70 px-5 py-2 text-xs font-semibold transition ${
              activeGame === "covo"
                ? "bg-white text-ink border-b-white shadow-[0_6px_16px_rgba(15,23,42,0.12)]"
                : "bg-card-border/30 text-muted hover:bg-white/80 hover:text-ink"
            }`}
          >
            Covo Game
          </button>
          <div className="h-full w-px bg-card-border/60" />
          <button
            type="button"
            onClick={() => setActiveGame("poker")}
            className={`rounded-tr-2xl border-b border-card-border/70 px-5 py-2 text-xs font-semibold transition ${
              activeGame === "poker"
                ? "bg-white text-ink border-b-white shadow-[0_6px_16px_rgba(15,23,42,0.12)]"
                : "bg-card-border/30 text-muted hover:bg-white/80 hover:text-ink"
            }`}
          >
            Poker
          </button>
        </div>
      </div>
      <div className="-mt-px flex-1">
      {activeGame === "covo" ? (
        <Card className="relative grid flex-1 min-h-[520px] grid-rows-[auto_1fr_auto] gap-3 overflow-hidden border border-card-border/70 bg-white/85 shadow-sm">
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
                        isTimerActiveForUser(leftOpponent?.id),
                        false,
                        getTypingTestBarOverride(leftOpponent?.id) ?? undefined
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
                        isTimerActiveForUser(user?.id),
                        false,
                        getTypingTestBarOverride(user?.id) ?? undefined
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
                      true,
                      getTypingTestBarOverride(rightOpponent?.id) ?? undefined
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
              {queueError && (isQueuing || rankedStatus.status === "waiting") && (
                <div className="mb-3 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
                  {queueError}
                </div>
              )}
              {showStatusBar && (
                <div
                  className={`mb-3 rounded-2xl border px-4 py-2 text-sm font-semibold ${matchStateTone}`}
                >
                  {isTypingTestRunning ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Typing test
                      </span>
                      <div className="flex-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-card-border/60">
                          <div
                            className="h-full bg-rose-500 transition-[width] duration-300"
                            style={{ width: `${typingTestProgress * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-muted">
                        {typingTestTimeLeft !== null ? `${typingTestTimeLeft}s` : "--"}
                      </span>
                    </div>
                  ) : roundTimeLeft !== null ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Round timer
                      </span>
                      <div className="flex-1">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-card-border/60">
                          <div
                            className="h-full bg-rose-500 transition-[width] duration-300"
                            style={{ width: `${roundProgress * 100}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-muted">
                        {roundTimeLeft !== null ? `${roundTimeLeft}s` : "--"}
                      </span>
                    </div>
                  ) : (
                    matchStateMessage || (
                      <span className="text-transparent" aria-hidden="true">
                        .
                      </span>
                    )
                  )}
                </div>
              )}
              {isIcebreakerRound &&
                cleanedIcebreaker &&
                !showCenterPanel &&
                !showBlockingModal && (
                  <div className="mb-3 flex items-center justify-center text-xs font-semibold text-muted">
                    {cleanedIcebreaker}
                  </div>
                )}
              {displayIsJudge &&
                isRolesRound &&
                !showCenterPanel &&
                !showBlockingModal &&
                (leftRole || rightRole) && (
                  <div className="mb-3 flex items-center justify-center gap-6 text-xs font-semibold text-muted">
                    {leftRole && (
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                        <span>{leftRole}</span>
                      </div>
                    )}
                    {rightRole && (
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />
                        <span>{rightRole}</span>
                      </div>
                    )}
                  </div>
                )}
              {!displayIsJudge &&
                isRolesRound &&
                characterRole &&
                !showCenterPanel &&
                !showBlockingModal && (
                  <div className="mb-3 text-center text-xs font-semibold text-muted">
                    Your role: {characterRole}
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
                      {typingTest.words.length === 0 ? (
                        <p className="mt-3 text-sm text-muted">Loading words...</p>
                      ) : (
                        <div
                          className="mt-4 flex max-w-3xl flex-wrap justify-center gap-x-3 gap-y-2 text-lg font-semibold text-ink"
                          aria-label="Typing test words"
                        >
                          {typingTest.words.map((word, wordIndex) => {
                            const typedWord = typingAttemptWords[wordIndex] ?? "";
                            const extraLetters =
                              typedWord.length > word.length
                                ? typedWord.slice(word.length)
                                : "";
                            return (
                              <span
                                key={`typing-word-${wordIndex}`}
                                className="flex items-center gap-0.5 font-mono"
                              >
                                {word.split("").map((letter, letterIndex) => {
                                  const typedChar = typedWord[letterIndex];
                                  const hasTyped = typeof typedChar === "string";
                                  const isCorrect =
                                    hasTyped &&
                                    typedChar.toLowerCase() === letter.toLowerCase();
                                  const displayChar = hasTyped ? typedChar : letter;
                                  const tone = !hasTyped
                                    ? "text-muted/40"
                                    : isCorrect
                                      ? "text-emerald-600"
                                      : "text-rose-500";
                                  return (
                                    <span
                                      key={`typing-letter-${wordIndex}-${letterIndex}`}
                                      className={tone}
                                    >
                                      {displayChar}
                                    </span>
                                  );
                                })}
                                {extraLetters.split("").map((letter, extraIndex) => (
                                  <span
                                    key={`typing-extra-${wordIndex}-${extraIndex}`}
                                    className="text-rose-500"
                                  >
                                    {letter}
                                  </span>
                                ))}
                              </span>
                            );
                          })}
                          {extraTypingWords.map((word, extraWordIndex) => (
                            <span
                              key={`typing-extra-word-${extraWordIndex}`}
                              className="flex items-center gap-0.5 font-mono text-rose-500"
                            >
                              {word.split("").map((letter, index) => (
                                <span key={`typing-extra-char-${extraWordIndex}-${index}`}>
                                  {letter}
                                </span>
                              ))}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                        Type the sequence to finish
                      </p>
                      {typingTestError && (
                        <div className="mt-4 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs font-semibold text-accent">
                          {typingTestError}
                        </div>
                      )}
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
                            const isVoteable =
                              displayIsJudge && isJudgingPhase && !isMine && !isVoting;
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
                                  onDoubleClick={
                                    isVoteable ? () => handleJudgeVote(message.id) : undefined
                                  }
                                  className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm shadow-sm ${messageTone} ${
                                    isSelected ? "ring-2 ring-accent/40" : ""
                                  } ${isVoteable ? "cursor-pointer" : ""}`}
                                  title={
                                    isVoteable ? "Double-click to vote for this message." : undefined
                                  }
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
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Round {roundNumber}
                  </p>
                  <p className="mt-2 text-base font-semibold text-ink">
                    {roundGameType === "roles"
                      ? "Character Roles: Stay in character."
                      : roundGameType === "icebreaker"
                        ? "Icebreaker: Answer the question."
                        : "Typing Test: Write 10 words."}
                  </p>
                  {!displayIsJudge && isRolesRound && characterRole && (
                    <p className="mt-2 text-sm font-semibold text-ink">
                      Your role: {characterRole}
                    </p>
                  )}
                  <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-card-border/60">
                    <div
                      className="h-full bg-accent transition-[width] duration-100"
                      style={{ width: `${roleModalProgress * 100}%` }}
                    />
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Round {roundNumber}
                  </p>
                  <p className="mt-2 text-base font-semibold text-ink">
                    {isTypingTestCountdown
                      ? "Typing Test: Write 10 words."
                      : `Typing Test: ${typingResultTitle}`}
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
      ) : (
        <Card className="relative flex flex-1 flex-col gap-6 overflow-hidden border border-card-border/70 bg-white/85 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">
                Poker Lounge
              </p>
              <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
                Texas Hold&#39;em
              </h1>
              <p className="mt-2 text-sm text-muted">
                Buy in with your coins to take a seat at the table.
              </p>
            </div>
            <div className="rounded-2xl border border-card-border/70 bg-white/80 px-4 py-2 text-sm font-semibold text-ink/80">
              Balance: {user?.coins ?? 0} coins
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="rounded-2xl border border-card-border/70 bg-white/80 p-6 text-center">
              <p className="text-sm font-semibold text-ink">
                Log in to join the poker table.
              </p>
              <p className="mt-2 text-sm text-muted">
                We&#39;ll use your coins to buy in.
              </p>
              <Button
                className="mt-4"
                requiresAuth={false}
                onClick={() => openAuthModal("login")}
              >
                Log in
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <div className="rounded-3xl border border-card-border/70 bg-white/80 p-6">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                  <span>Pot: {pokerState?.pot ?? 0}</span>
                  <span>
                    Blinds: {pokerState?.blinds.small ?? 0}/
                    {pokerState?.blinds.big ?? 0}
                  </span>
                  <span>
                    {pokerState ? `Street: ${pokerState.street}` : "Waiting"}
                  </span>
                </div>
                <div className="mt-6 flex flex-col gap-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        Dealer Bot
                        {pokerState?.dealer === "bot" ? " · D" : ""}
                      </p>
                      <p className="text-xs text-muted">
                        Chips: {pokerState?.botChips ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pokerState?.botCards?.length
                        ? pokerState.botCards.map((card, index) => (
                            <div key={`bot-card-${index}`}>{renderPokerCard(card)}</div>
                          ))
                        : pokerState?.status === "in_hand"
                          ? [0, 1].map((index) => (
                              <div key={`bot-hidden-${index}`}>
                                {renderPokerCard(undefined, true)}
                              </div>
                            ))
                          : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap justify-center gap-2">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div key={`community-${index}`}>
                        {renderPokerCard(pokerState?.community?.[index])}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {myName}
                        {pokerState?.dealer === "player" ? " · D" : ""}
                      </p>
                      <p className="text-xs text-muted">
                        Chips: {pokerState?.playerChips ?? 0}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {pokerState?.playerCards?.length
                        ? pokerState.playerCards.map((card, index) => (
                            <div key={`player-card-${index}`}>
                              {renderPokerCard(card)}
                            </div>
                          ))
                        : [0, 1].map((index) => (
                            <div key={`player-empty-${index}`}>
                              {renderPokerCard(undefined)}
                            </div>
                          ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <form className="flex flex-wrap items-end gap-3" onSubmit={handlePokerBuyIn}>
                  <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Buy-in
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={pokerBuyIn}
                      onChange={(event) => setPokerBuyIn(event.target.value)}
                      className={inputClasses}
                      placeholder="Enter coins"
                    />
                  </label>
                  <Button type="submit" disabled={isBuyingIn}>
                    {isBuyingIn ? "Buying in..." : "Buy in"}
                  </Button>
                </form>

                {pokerError && (
                  <div className="rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent">
                    {pokerError}
                  </div>
                )}

                {isPokerLoading ? (
                  <div className="rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-muted">
                    Loading table...
                  </div>
                ) : pokerState ? (
                  <div className="rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm">
                    <p className="text-sm font-semibold text-ink">
                      {pokerState.status === "busted"
                        ? "You&#39;re out of chips."
                        : pokerState.status === "hand_over"
                          ? pokerState.winner === "player"
                            ? "You won the last hand."
                            : pokerState.winner === "bot"
                              ? "Dealer bot took the pot."
                              : "Split pot."
                          : pokerIsPlayerTurn
                            ? "Your turn to act."
                            : "Dealer bot is thinking..."}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      Current bet: {pokerState.currentBet} · Your bet: {pokerState.playerBet}
                    </p>
                    {(pokerState.status === "waiting" ||
                      pokerState.status === "hand_over" ||
                      pokerState.status === "busted") && (
                      <div className="mt-3">
                        <Button onClick={handlePokerStartHand} disabled={isPokerActing}>
                          {pokerState.status === "hand_over" ? "Deal next hand" : "Deal hand"}
                        </Button>
                      </div>
                    )}
                    {pokerState.status === "in_hand" && pokerCanAct && (
                      <div className="mt-3 flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          {pokerActions?.canCheck && (
                            <Button
                              variant="outline"
                              onClick={() => handlePokerAction("check")}
                              disabled={isPokerActing}
                            >
                              Check
                            </Button>
                          )}
                          {pokerActions?.canCall && (
                            <Button
                              variant="outline"
                              onClick={() => handlePokerAction("call")}
                              disabled={isPokerActing}
                            >
                              Call {pokerCallAmount}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={() => handlePokerAction("fold")}
                            disabled={isPokerActing}
                          >
                            Fold
                          </Button>
                        </div>
                        {(pokerActions?.canBet || pokerActions?.canRaise) && (
                          <div className="flex flex-wrap items-center gap-2">
                            <input
                              type="number"
                              min={pokerActions?.minRaise ?? 1}
                              step={1}
                              value={pokerRaiseAmount}
                              onChange={(event) => setPokerRaiseAmount(event.target.value)}
                              className={inputClasses}
                              placeholder={`Min ${pokerActions?.minRaise ?? 1}`}
                            />
                            <Button
                              onClick={() =>
                                handlePokerAction(
                                  pokerState.currentBet === 0 ? "bet" : "raise"
                                )
                              }
                              disabled={isPokerActing}
                            >
                              {pokerState.currentBet === 0 ? "Bet" : "Raise"}
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-card-border/70 bg-white/80 px-4 py-3 text-sm text-muted">
                    Buy in to start a table and deal your first hand.
                  </div>
                )}

                <div className="rounded-2xl border border-card-border/70 bg-white/80 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">
                    Table Log
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-muted">
                    {pokerState?.log?.length ? (
                      pokerState.log.map((entry) => (
                        <div key={entry.id}>{entry.text}</div>
                      ))
                    ) : (
                      <div>Deal a hand to start the action.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}
      </div>
    </div>
  );
}
