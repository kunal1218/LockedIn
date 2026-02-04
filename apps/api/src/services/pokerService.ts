import { randomUUID } from "crypto";
import { getRedis } from "../db/redis";
import { ensureUsersTable } from "./authService";
import { db } from "../db";

export class PokerError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type Suit = "S" | "H" | "D" | "C";
export type CardCode = `${string}${Suit}`;

type PokerStreet = "preflop" | "flop" | "turn" | "river" | "showdown";

type PokerStatus = "waiting" | "in_hand" | "hand_over" | "busted";

type PokerTurn = "player" | "bot";

type PokerLog = { id: string; text: string };

type PokerHandRank = {
  category: number;
  tiebreaker: number[];
  label: string;
};

type PokerSession = {
  userId: string;
  playerChips: number;
  botChips: number;
  dealer: PokerTurn;
  handNumber: number;
  deck: CardCode[];
  playerCards: CardCode[];
  botCards: CardCode[];
  community: CardCode[];
  pot: number;
  street: PokerStreet;
  status: PokerStatus;
  turn: PokerTurn;
  currentBet: number;
  playerBet: number;
  botBet: number;
  blinds: { small: number; big: number };
  log: PokerLog[];
  winner?: "player" | "bot" | "tie";
  revealBotCards?: boolean;
  lastUpdatedAt: string;
};

type PokerActions = {
  canCheck: boolean;
  canCall: boolean;
  canRaise: boolean;
  canBet: boolean;
  callAmount: number;
  minRaise: number;
  maxRaise: number;
};

export type PokerClientState = {
  status: PokerStatus;
  street: PokerStreet;
  playerChips: number;
  botChips: number;
  pot: number;
  community: CardCode[];
  playerCards: CardCode[];
  botCards: CardCode[];
  dealer: PokerTurn;
  turn: PokerTurn;
  currentBet: number;
  playerBet: number;
  botBet: number;
  blinds: { small: number; big: number };
  log: PokerLog[];
  winner?: "player" | "bot" | "tie";
  actions?: PokerActions;
  handSummary?: string;
};

type PokerAction =
  | { action: "fold" }
  | { action: "check" }
  | { action: "call" }
  | { action: "bet"; amount: number }
  | { action: "raise"; amount: number };

const SESSION_TTL_SECONDS = 60 * 60 * 6;
const memoryStore = new Map<string, PokerSession>();

const RANK_LABELS: Record<number, string> = {
  14: "Ace",
  13: "King",
  12: "Queen",
  11: "Jack",
  10: "Ten",
  9: "Nine",
  8: "Eight",
  7: "Seven",
  6: "Six",
  5: "Five",
  4: "Four",
  3: "Three",
  2: "Two",
};

const HAND_LABELS = [
  "High Card",
  "One Pair",
  "Two Pair",
  "Three of a Kind",
  "Straight",
  "Flush",
  "Full House",
  "Four of a Kind",
  "Straight Flush",
];

const toLog = (text: string): PokerLog => ({ id: randomUUID(), text });

const getSessionKey = (userId: string) => `poker:session:${userId}`;

const loadSession = async (userId: string): Promise<PokerSession | null> => {
  const redis = await getRedis();
  if (redis) {
    const raw = await redis.get(getSessionKey(userId));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PokerSession;
    } catch {
      return null;
    }
  }
  return memoryStore.get(userId) ?? null;
};

const saveSession = async (session: PokerSession) => {
  session.lastUpdatedAt = new Date().toISOString();
  const redis = await getRedis();
  if (redis) {
    await redis.set(getSessionKey(session.userId), JSON.stringify(session), {
      EX: SESSION_TTL_SECONDS,
    });
    return;
  }
  memoryStore.set(session.userId, session);
};

const deleteSession = async (userId: string) => {
  const redis = await getRedis();
  if (redis) {
    await redis.del(getSessionKey(userId));
  }
  memoryStore.delete(userId);
};

const createDeck = (): CardCode[] => {
  const suits: Suit[] = ["S", "H", "D", "C"];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "T", "J", "Q", "K", "A"];
  const deck: CardCode[] = [];
  suits.forEach((suit) => {
    ranks.forEach((rank) => {
      deck.push(`${rank}${suit}` as CardCode);
    });
  });
  return deck;
};

const shuffleDeck = (deck: CardCode[]) => {
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
};

const drawCard = (session: PokerSession): CardCode => {
  const card = session.deck.pop();
  if (!card) {
    throw new PokerError("The deck ran out of cards.", 500);
  }
  return card;
};

const parseRank = (card: CardCode) => {
  const rank = card[0];
  if (rank === "A") return 14;
  if (rank === "K") return 13;
  if (rank === "Q") return 12;
  if (rank === "J") return 11;
  if (rank === "T") return 10;
  return Number(rank);
};

const parseSuit = (card: CardCode) => card[1] as Suit;

const getStraightHigh = (ranks: number[]) => {
  const unique = Array.from(new Set(ranks)).sort((a, b) => b - a);
  if (unique.length < 5) return null;
  if (unique.includes(14)) {
    unique.push(1);
  }
  let run = 1;
  for (let i = 0; i < unique.length - 1; i += 1) {
    if (unique[i] - 1 === unique[i + 1]) {
      run += 1;
      if (run >= 5) {
        return unique[i - 3];
      }
    } else {
      run = 1;
    }
  }
  return null;
};

const evaluateFiveCardHand = (cards: CardCode[]): PokerHandRank => {
  const ranks = cards.map(parseRank).sort((a, b) => b - a);
  const suits = cards.map(parseSuit);
  const isFlush = suits.every((suit) => suit === suits[0]);
  const straightHigh = getStraightHigh(ranks);

  const counts = new Map<number, number>();
  ranks.forEach((rank) => counts.set(rank, (counts.get(rank) ?? 0) + 1));
  const groups = Array.from(counts.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  if (isFlush && straightHigh) {
    return { category: 8, tiebreaker: [straightHigh], label: "Straight Flush" };
  }

  if (groups[0][1] === 4) {
    const kicker = groups.find(([, count]) => count === 1)?.[0] ?? 0;
    return {
      category: 7,
      tiebreaker: [groups[0][0], kicker],
      label: "Four of a Kind",
    };
  }

  if (groups[0][1] === 3 && groups[1]?.[1] === 2) {
    return {
      category: 6,
      tiebreaker: [groups[0][0], groups[1][0]],
      label: "Full House",
    };
  }

  if (isFlush) {
    return { category: 5, tiebreaker: ranks, label: "Flush" };
  }

  if (straightHigh) {
    return { category: 4, tiebreaker: [straightHigh], label: "Straight" };
  }

  if (groups[0][1] === 3) {
    const kickers = groups.filter(([, count]) => count === 1).map(([rank]) => rank);
    return {
      category: 3,
      tiebreaker: [groups[0][0], ...kickers],
      label: "Three of a Kind",
    };
  }

  if (groups[0][1] === 2 && groups[1]?.[1] === 2) {
    const highPair = Math.max(groups[0][0], groups[1][0]);
    const lowPair = Math.min(groups[0][0], groups[1][0]);
    const kicker = groups.find(([, count]) => count === 1)?.[0] ?? 0;
    return {
      category: 2,
      tiebreaker: [highPair, lowPair, kicker],
      label: "Two Pair",
    };
  }

  if (groups[0][1] === 2) {
    const kickers = groups.filter(([, count]) => count === 1).map(([rank]) => rank);
    return {
      category: 1,
      tiebreaker: [groups[0][0], ...kickers],
      label: "One Pair",
    };
  }

  return { category: 0, tiebreaker: ranks, label: "High Card" };
};

const compareHands = (a: PokerHandRank, b: PokerHandRank) => {
  if (a.category !== b.category) {
    return a.category - b.category;
  }
  const max = Math.max(a.tiebreaker.length, b.tiebreaker.length);
  for (let i = 0; i < max; i += 1) {
    const diff = (a.tiebreaker[i] ?? 0) - (b.tiebreaker[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
};

const evaluateBestHand = (cards: CardCode[]): PokerHandRank => {
  if (cards.length < 5) {
    return { category: 0, tiebreaker: cards.map(parseRank).sort((a, b) => b - a), label: "High Card" };
  }
  let best: PokerHandRank | null = null;
  for (let i = 0; i < cards.length - 4; i += 1) {
    for (let j = i + 1; j < cards.length - 3; j += 1) {
      for (let k = j + 1; k < cards.length - 2; k += 1) {
        for (let l = k + 1; l < cards.length - 1; l += 1) {
          for (let m = l + 1; m < cards.length; m += 1) {
            const hand = evaluateFiveCardHand([cards[i], cards[j], cards[k], cards[l], cards[m]]);
            if (!best || compareHands(hand, best) > 0) {
              best = hand;
            }
          }
        }
      }
    }
  }
  return best ?? evaluateFiveCardHand(cards.slice(0, 5));
};

const describeHand = (hand: PokerHandRank) => {
  const top = hand.tiebreaker[0];
  if (hand.category === 0) {
    return `High Card ${RANK_LABELS[top] ?? ""}`.trim();
  }
  if (hand.category === 1 || hand.category === 3 || hand.category === 7) {
    return `${HAND_LABELS[hand.category]} of ${RANK_LABELS[top] ?? ""}s`;
  }
  if (hand.category === 2) {
    const second = hand.tiebreaker[1];
    return `Two Pair (${RANK_LABELS[top]} & ${RANK_LABELS[second]})`;
  }
  if (hand.category === 4 || hand.category === 8) {
    return `${HAND_LABELS[hand.category]} (${RANK_LABELS[top]} high)`;
  }
  if (hand.category === 5) {
    return `Flush (${RANK_LABELS[top]} high)`;
  }
  if (hand.category === 6) {
    const second = hand.tiebreaker[1];
    return `Full House (${RANK_LABELS[top]} over ${RANK_LABELS[second]})`;
  }
  return HAND_LABELS[hand.category] ?? "Hand";
};

const getBlinds = (buyIn: number) => {
  const big = Math.max(2, Math.floor(buyIn * 0.05));
  const small = Math.max(1, Math.floor(big / 2));
  return { small, big };
};

const buildClientState = (session: PokerSession): PokerClientState => {
  const callAmount = Math.max(0, session.currentBet - session.playerBet);
  const maxRaise = Math.max(0, session.playerChips - callAmount);
  const canAct = session.status === "in_hand" && session.turn === "player";
  const actions: PokerActions = {
    canCheck: callAmount === 0 && session.playerChips >= 0,
    canCall: callAmount > 0 && session.playerChips > 0,
    canBet: session.currentBet === 0 && session.playerChips > 0,
    canRaise: session.currentBet > 0 && session.playerChips > callAmount,
    callAmount,
    minRaise: session.blinds.big,
    maxRaise,
  };

  return {
    status: session.status,
    street: session.street,
    playerChips: session.playerChips,
    botChips: session.botChips,
    pot: session.pot,
    community: session.community,
    playerCards: session.playerCards,
    botCards: session.revealBotCards ? session.botCards : [],
    dealer: session.dealer,
    turn: session.turn,
    currentBet: session.currentBet,
    playerBet: session.playerBet,
    botBet: session.botBet,
    blinds: session.blinds,
    log: session.log.slice(-12),
    winner: session.winner,
    actions: canAct ? actions : undefined,
    handSummary: session.revealBotCards ? session.log.find((entry) => entry.text.startsWith("Showdown"))?.text : undefined,
  };
};

const ensureSession = async (userId: string) => {
  const session = await loadSession(userId);
  if (!session) {
    throw new PokerError("Buy in to start a poker session.", 400);
  }
  return session;
};

const resetBets = (session: PokerSession) => {
  session.currentBet = 0;
  session.playerBet = 0;
  session.botBet = 0;
};

const advanceStreet = (session: PokerSession) => {
  if (session.street === "preflop") {
    const flop = [drawCard(session), drawCard(session), drawCard(session)];
    session.community.push(...flop);
    session.street = "flop";
    session.log.push(toLog(`Flop: ${flop.join(" ")}.`));
  } else if (session.street === "flop") {
    const card = drawCard(session);
    session.community.push(card);
    session.street = "turn";
    session.log.push(toLog(`Turn: ${card}.`));
  } else if (session.street === "turn") {
    const card = drawCard(session);
    session.community.push(card);
    session.street = "river";
    session.log.push(toLog(`River: ${card}.`));
  }
  resetBets(session);
  session.turn = session.dealer === "player" ? "bot" : "player";
};

const awardPot = (session: PokerSession, winner: "player" | "bot" | "tie") => {
  if (winner === "tie") {
    const split = Math.floor(session.pot / 2);
    const remainder = session.pot - split * 2;
    session.playerChips += split + (session.dealer === "player" ? remainder : 0);
    session.botChips += split + (session.dealer === "bot" ? remainder : 0);
  } else if (winner === "player") {
    session.playerChips += session.pot;
  } else {
    session.botChips += session.pot;
  }
  session.pot = 0;
};

const finishHand = (session: PokerSession, winner: "player" | "bot" | "tie") => {
  session.status = "hand_over";
  session.winner = winner;
  session.revealBotCards = true;
  awardPot(session, winner);
  session.log.push(toLog(`Hand over. ${winner === "tie" ? "It\'s a split pot." : winner === "player" ? "You win the pot." : "Dealer bot wins the pot."}`));
  if (session.playerChips <= 0) {
    session.status = "busted";
    session.log.push(toLog("You are out of chips. Buy in again to keep playing."));
  }
  if (session.botChips <= 0) {
    session.botChips = Math.max(session.botChips, session.blinds.big * 10);
    session.log.push(toLog("Dealer bot topped up its chips."));
  }
};

const showdown = (session: PokerSession) => {
  session.street = "showdown";
  const playerHand = evaluateBestHand([...session.playerCards, ...session.community]);
  const botHand = evaluateBestHand([...session.botCards, ...session.community]);
  const comparison = compareHands(playerHand, botHand);
  let winner: "player" | "bot" | "tie" = "tie";
  if (comparison > 0) {
    winner = "player";
  } else if (comparison < 0) {
    winner = "bot";
  }
  session.log.push(
    toLog(
      `Showdown: You have ${describeHand(playerHand)}. Dealer bot has ${describeHand(botHand)}.`
    )
  );
  finishHand(session, winner);
};

const dealRemainingToShowdown = (session: PokerSession) => {
  while (session.street !== "river") {
    advanceStreet(session);
  }
  showdown(session);
};

const postBlinds = (session: PokerSession) => {
  const { small, big } = session.blinds;
  if (session.dealer === "player") {
    const playerBlind = Math.min(session.playerChips, small);
    session.playerChips -= playerBlind;
    session.playerBet = playerBlind;
    const botBlind = Math.min(session.botChips, big);
    session.botChips -= botBlind;
    session.botBet = botBlind;
  } else {
    const botBlind = Math.min(session.botChips, small);
    session.botChips -= botBlind;
    session.botBet = botBlind;
    const playerBlind = Math.min(session.playerChips, big);
    session.playerChips -= playerBlind;
    session.playerBet = playerBlind;
  }
  session.currentBet = Math.max(session.playerBet, session.botBet);
  session.pot += session.playerBet + session.botBet;
  session.log.push(toLog(`Blinds posted: ${small}/${big}.`));
};

const computeBotDecision = (session: PokerSession, callAmount: number) => {
  const visible = [...session.community, ...session.botCards];
  const hand = evaluateBestHand(visible);
  const strength = hand.category;
  const hasPairOrBetter = strength >= 1;
  const aggressive = strength >= 3;
  const cautiousFold = !hasPairOrBetter && callAmount > session.blinds.big * 2;

  if (callAmount === 0) {
    if (hasPairOrBetter && Math.random() < 0.45) {
      const bet = Math.min(session.botChips, session.blinds.big * (aggressive ? 3 : 2));
      if (bet > 0) {
        return { action: "bet" as const, amount: bet };
      }
    }
    return { action: "check" as const };
  }

  if (cautiousFold && Math.random() < 0.6) {
    return { action: "fold" as const };
  }

  if (aggressive && session.botChips > callAmount + session.blinds.big && Math.random() < 0.3) {
    const raise = Math.min(session.botChips - callAmount, session.blinds.big * 2);
    return { action: "raise" as const, amount: raise };
  }

  return { action: "call" as const };
};

const applyAction = (session: PokerSession, actor: PokerTurn, action: PokerAction) => {
  const isPlayer = actor === "player";
  const chipField = isPlayer ? "playerChips" : "botChips";
  const betField = isPlayer ? "playerBet" : "botBet";
  const name = isPlayer ? "You" : "Dealer bot";
  const callAmount = Math.max(0, session.currentBet - session[betField]);

  if (action.action === "fold") {
    session.log.push(toLog(`${name} folds.`));
    finishHand(session, isPlayer ? "bot" : "player");
    return;
  }

  if (action.action === "check") {
    if (callAmount > 0) {
      throw new PokerError("You cannot check when facing a bet.", 400);
    }
    session.log.push(toLog(`${name} checks.`));
    session.turn = isPlayer ? "bot" : "player";
    return;
  }

  if (action.action === "call") {
    const toCall = Math.min(callAmount, session[chipField]);
    session[chipField] -= toCall;
    session[betField] += toCall;
    session.pot += toCall;
    session.log.push(toLog(`${name} calls ${toCall}.`));
    session.turn = isPlayer ? "bot" : "player";
    return;
  }

  if (action.action === "bet" || action.action === "raise") {
    const amount = action.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PokerError("Enter a valid bet amount.", 400);
    }
    if (session.currentBet > 0 && session[chipField] <= callAmount) {
      throw new PokerError("Not enough chips to raise.", 400);
    }
    const minRaise = session.blinds.big;
    if (amount < minRaise && session[chipField] > amount) {
      throw new PokerError(`Minimum bet is ${minRaise}.`, 400);
    }
    const total = callAmount + amount;
    const wager = Math.min(total, session[chipField]);
    session[chipField] -= wager;
    session[betField] += wager;
    session.pot += wager;
    session.currentBet = session[betField];
    session.log.push(toLog(`${name} ${action.action === "bet" ? "bets" : "raises"} ${wager}.`));
    session.turn = isPlayer ? "bot" : "player";
  }
};

const maybeAdvance = (session: PokerSession) => {
  if (session.status !== "in_hand") {
    return;
  }
  const betsMatched = session.playerBet === session.botBet;
  if (!betsMatched) {
    return;
  }
  if (session.playerChips === 0 || session.botChips === 0) {
    dealRemainingToShowdown(session);
    return;
  }
  if (session.street === "river") {
    showdown(session);
    return;
  }
  advanceStreet(session);
};

const runBotTurn = (session: PokerSession) => {
  if (session.turn !== "bot" || session.status !== "in_hand") {
    return;
  }
  const callAmount = Math.max(0, session.currentBet - session.botBet);
  const decision = computeBotDecision(session, callAmount);
  applyAction(session, "bot", decision);
  if (session.status !== "in_hand") {
    return;
  }
  if (decision.action === "check" || decision.action === "call") {
    maybeAdvance(session);
    return;
  }
};

const getOrCreateSession = async (userId: string, amount: number) => {
  let session = await loadSession(userId);
  if (!session) {
    const blinds = getBlinds(amount);
    session = {
      userId,
      playerChips: amount,
      botChips: amount,
      dealer: "player",
      handNumber: 0,
      deck: [],
      playerCards: [],
      botCards: [],
      community: [],
      pot: 0,
      street: "preflop",
      status: "waiting",
      turn: "player",
      currentBet: 0,
      playerBet: 0,
      botBet: 0,
      blinds,
      log: [
        toLog("Poker session created."),
        toLog(`Blinds are ${blinds.small}/${blinds.big}.`),
      ],
      lastUpdatedAt: new Date().toISOString(),
    };
    return session;
  }

  session.playerChips += amount;
  session.log.push(toLog(`Added ${amount} chips.`));
  if (session.status === "busted" && session.playerChips > 0) {
    session.status = "waiting";
    session.log.push(toLog("You are back in the game."));
  }
  return session;
};

export const buyInToPoker = async (params: {
  userId: string;
  amount: number;
}): Promise<{ coins: number; chips: number }> => {
  await ensureUsersTable();
  const amount = Math.floor(params.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PokerError("Enter a valid buy-in amount.", 400);
  }

  const result = await db.query(
    `UPDATE users
     SET coins = COALESCE(coins, 0) - $2
     WHERE id = $1
       AND COALESCE(coins, 0) >= $2
     RETURNING coins`,
    [params.userId, amount]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new PokerError("Not enough coins for that buy-in.", 400);
  }

  const session = await getOrCreateSession(params.userId, amount);
  await saveSession(session);

  const coins = Number(result.rows[0]?.coins ?? 0);
  return { coins, chips: amount };
};

export const getPokerState = async (userId: string): Promise<PokerClientState | null> => {
  const session = await loadSession(userId);
  if (!session) {
    return null;
  }
  return buildClientState(session);
};

export const startPokerHand = async (userId: string): Promise<PokerClientState> => {
  const session = await ensureSession(userId);
  if (session.playerChips <= 0) {
    session.status = "busted";
    session.log.push(toLog("You are out of chips."));
    await saveSession(session);
    return buildClientState(session);
  }

  session.handNumber += 1;
  session.dealer = session.handNumber % 2 === 1 ? "player" : "bot";
  session.deck = createDeck();
  shuffleDeck(session.deck);
  session.playerCards = [drawCard(session), drawCard(session)];
  session.botCards = [drawCard(session), drawCard(session)];
  session.community = [];
  session.pot = 0;
  session.street = "preflop";
  session.status = "in_hand";
  session.turn = session.dealer;
  session.winner = undefined;
  session.revealBotCards = false;
  resetBets(session);
  postBlinds(session);
  session.log.push(toLog(`Hand ${session.handNumber} started.`));
  session.log.push(toLog(`Dealer: ${session.dealer === "player" ? "You" : "Dealer bot"}.`));

  if (session.playerChips === 0 || session.botChips === 0) {
    dealRemainingToShowdown(session);
  }

  await saveSession(session);
  return buildClientState(session);
};

export const applyPokerAction = async (
  userId: string,
  action: PokerAction
): Promise<PokerClientState> => {
  const session = await ensureSession(userId);
  if (session.status !== "in_hand") {
    throw new PokerError("No active hand. Deal a new hand to play.", 400);
  }
  if (session.turn !== "player") {
    throw new PokerError("Waiting for dealer bot.", 400);
  }

  applyAction(session, "player", action);
  if (session.status === "in_hand") {
    if (action.action === "call") {
      maybeAdvance(session);
    }
    runBotTurn(session);
    if (session.status === "in_hand") {
      if (session.turn === "bot") {
        runBotTurn(session);
      }
    }
  }

  await saveSession(session);
  return buildClientState(session);
};

export const resetPokerSession = async (userId: string) => {
  await deleteSession(userId);
};
