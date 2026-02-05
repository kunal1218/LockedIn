import { randomUUID } from "crypto";
import { db } from "../db";
import { getRedis } from "../db/redis";
import { ensureUsersTable } from "./authService";

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
type PokerTableStatus = "waiting" | "in_hand" | "showdown";
type PokerPlayerStatus = "active" | "folded" | "all_in" | "out";

type PokerLog = { id: string; text: string };

type PokerPlayer = {
  userId: string;
  name: string;
  handle: string;
  chips: number;
  seatIndex: number;
  inHand: boolean;
  status: PokerPlayerStatus;
  bet: number;
  totalBet: number;
  cards: CardCode[];
  pendingLeave?: boolean;
  lastSeenAt?: string;
};

type PokerTable = {
  id: string;
  maxSeats: number;
  seats: Array<PokerPlayer | null>;
  dealerIndex: number;
  smallBlindIndex?: number | null;
  bigBlindIndex?: number | null;
  smallBlind: number;
  bigBlind: number;
  deck: CardCode[];
  community: CardCode[];
  pot: number;
  currentBet: number;
  minRaise: number;
  currentPlayerIndex: number | null;
  pendingActionUserIds: string[];
  street: PokerStreet;
  status: PokerTableStatus;
  handId: string | null;
  log: PokerLog[];
  lastUpdatedAt: string;
};

type PokerClientSeat = {
  seatIndex: number;
  userId: string;
  name: string;
  handle: string;
  chips: number;
  bet: number;
  status: PokerPlayerStatus;
  isDealer: boolean;
  cards?: CardCode[];
};

export type PokerClientState = {
  tableId: string;
  status: PokerTableStatus;
  street: PokerStreet;
  pot: number;
  community: CardCode[];
  seats: Array<PokerClientSeat | null>;
  currentPlayerIndex: number | null;
  currentBet: number;
  minRaise: number;
  smallBlindIndex: number | null;
  bigBlindIndex: number | null;
  youSeatIndex: number | null;
  actions?: {
    canCheck: boolean;
    canCall: boolean;
    canRaise: boolean;
    canBet: boolean;
    callAmount: number;
    minRaise: number;
    maxRaise: number;
  };
  log: PokerLog[];
};

export type PokerAction =
  | { action: "fold" }
  | { action: "check" }
  | { action: "call" }
  | { action: "bet"; amount: number }
  | { action: "raise"; amount: number };

type PokerHandRank = {
  category: number;
  tiebreaker: number[];
  label: string;
};

type SidePot = { amount: number; eligibleUserIds: string[] };

type PokerQueueEntry = {
  userId: string;
  name: string;
  handle: string;
  amount: number;
  enqueuedAt: number;
};

const MAX_SEATS = 8;
const MIN_PLAYERS = 2;
const MAX_TABLES = 25;
const SESSION_TTL_SECONDS = 60 * 60 * 6;
const TABLES_KEY = "poker:tables";
const QUEUE_KEY = "poker:queue";
const QUEUE_DATA_KEY = "poker:queue:data";

const memoryTables = new Map<string, PokerTable>();
const memoryPlayerTable = new Map<string, string>();
const memoryTableIds = new Set<string>();
const memoryQueue: PokerQueueEntry[] = [];

const toLog = (text: string): PokerLog => ({ id: randomUUID(), text });

const normalizeHandle = (handle?: string | null) =>
  handle ? handle.replace(/^@/, "") : "";

const getTableKey = (id: string) => `poker:table:${id}`;
const getPlayerKey = (userId: string) => `poker:player:${userId}`;

const readTables = async () => {
  const redis = await getRedis();
  if (redis) {
    return redis.sMembers(TABLES_KEY);
  }
  return Array.from(memoryTableIds);
};

const saveTable = async (table: PokerTable) => {
  table.lastUpdatedAt = new Date().toISOString();
  const redis = await getRedis();
  if (redis) {
    await redis.set(getTableKey(table.id), JSON.stringify(table), {
      EX: SESSION_TTL_SECONDS,
    });
    await redis.sAdd(TABLES_KEY, table.id);
    return;
  }
  memoryTables.set(table.id, table);
  memoryTableIds.add(table.id);
};

const loadTable = async (id: string): Promise<PokerTable | null> => {
  const redis = await getRedis();
  if (redis) {
    const raw = await redis.get(getTableKey(id));
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PokerTable;
    } catch {
      return null;
    }
  }
  return memoryTables.get(id) ?? null;
};

const loadActiveTables = async () => {
  const tableIds = await readTables();
  const tables: PokerTable[] = [];
  for (const id of tableIds) {
    const table = await loadTable(id);
    if (!table) {
      await removeTableId(id);
      continue;
    }
    if (getPlayers(table).length === 0) {
      await removeTable(id);
      continue;
    }
    tables.push(table);
  }
  return tables;
};

const setPlayerTableId = async (userId: string, tableId: string) => {
  const redis = await getRedis();
  if (redis) {
    await redis.set(getPlayerKey(userId), tableId, { EX: SESSION_TTL_SECONDS });
    return;
  }
  memoryPlayerTable.set(userId, tableId);
};

const getPlayerTableId = async (userId: string): Promise<string | null> => {
  const redis = await getRedis();
  if (redis) {
    const tableId = await redis.get(getPlayerKey(userId));
    return tableId ?? null;
  }
  return memoryPlayerTable.get(userId) ?? null;
};

const clearPlayerTableId = async (userId: string) => {
  const redis = await getRedis();
  if (redis) {
    await redis.del(getPlayerKey(userId));
    return;
  }
  memoryPlayerTable.delete(userId);
};

const removeTableId = async (tableId: string) => {
  const redis = await getRedis();
  if (redis) {
    await redis.sRem(TABLES_KEY, tableId);
  }
  memoryTableIds.delete(tableId);
};

const removeTable = async (tableId: string) => {
  const redis = await getRedis();
  if (redis) {
    await redis.del(getTableKey(tableId));
    await redis.sRem(TABLES_KEY, tableId);
  }
  memoryTables.delete(tableId);
  memoryTableIds.delete(tableId);
};

const getQueuePosition = async (userId: string) => {
  const redis = await getRedis();
  if (redis) {
    const rank = await redis.zRank(QUEUE_KEY, userId);
    return rank === null ? null : rank + 1;
  }
  const index = memoryQueue.findIndex((entry) => entry.userId === userId);
  return index === -1 ? null : index + 1;
};

const getQueueLength = async () => {
  const redis = await getRedis();
  if (redis) {
    return Number(await redis.zCard(QUEUE_KEY));
  }
  return memoryQueue.length;
};

const enqueuePlayer = async (entry: PokerQueueEntry) => {
  const redis = await getRedis();
  if (redis) {
    const existingScore = await redis.zScore(QUEUE_KEY, entry.userId);
    if (existingScore === null) {
      await redis.zAdd(QUEUE_KEY, { score: entry.enqueuedAt, value: entry.userId });
    }
    await redis.hSet(
      QUEUE_DATA_KEY,
      entry.userId,
      JSON.stringify({
        name: entry.name,
        handle: entry.handle,
        amount: entry.amount,
      })
    );
    const rank = await redis.zRank(QUEUE_KEY, entry.userId);
    return rank === null ? null : rank + 1;
  }

  const existingIndex = memoryQueue.findIndex(
    (queued) => queued.userId === entry.userId
  );
  if (existingIndex >= 0) {
    memoryQueue[existingIndex] = {
      ...memoryQueue[existingIndex],
      name: entry.name,
      handle: entry.handle,
      amount: entry.amount,
    };
    return existingIndex + 1;
  }
  memoryQueue.push(entry);
  return memoryQueue.length;
};

const dequeuePlayer = async (userId: string) => {
  const redis = await getRedis();
  if (redis) {
    await redis.zRem(QUEUE_KEY, userId);
    await redis.hDel(QUEUE_DATA_KEY, userId);
    return;
  }
  const index = memoryQueue.findIndex((entry) => entry.userId === userId);
  if (index >= 0) {
    memoryQueue.splice(index, 1);
  }
};

const readQueueEntries = async (limit?: number): Promise<PokerQueueEntry[]> => {
  const redis = await getRedis();
  if (redis) {
    const stop = typeof limit === "number" ? Math.max(0, limit - 1) : -1;
    const entries = await redis.zRangeWithScores(QUEUE_KEY, 0, stop);
    if (!entries.length) {
      return [];
    }
    const ids = entries.map((entry) => entry.value);
    const rawData = await redis.hmGet(QUEUE_DATA_KEY, ids);
    return entries
      .map((entry, index) => {
        const raw = rawData[index];
        if (!raw) {
          return null;
        }
        try {
          const parsed = JSON.parse(raw) as {
            name?: string;
            handle?: string;
            amount?: number;
          };
          return {
            userId: entry.value,
            name: parsed.name ?? "Player",
            handle: normalizeHandle(parsed.handle),
            amount: Math.max(1, Math.floor(parsed.amount ?? 0)),
            enqueuedAt: entry.score,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean) as PokerQueueEntry[];
  }

  return typeof limit === "number" ? memoryQueue.slice(0, limit) : [...memoryQueue];
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

const drawCard = (table: PokerTable): CardCode => {
  const card = table.deck.pop();
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
    return {
      category: 0,
      tiebreaker: cards.map(parseRank).sort((a, b) => b - a),
      label: "High Card",
    };
  }
  let best: PokerHandRank | null = null;
  for (let i = 0; i < cards.length - 4; i += 1) {
    for (let j = i + 1; j < cards.length - 3; j += 1) {
      for (let k = j + 1; k < cards.length - 2; k += 1) {
        for (let l = k + 1; l < cards.length - 1; l += 1) {
          for (let m = l + 1; m < cards.length; m += 1) {
            const hand = evaluateFiveCardHand([
              cards[i],
              cards[j],
              cards[k],
              cards[l],
              cards[m],
            ]);
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

const createTable = (smallBlind: number, bigBlind: number): PokerTable => {
  const id = randomUUID();
  return {
    id,
    maxSeats: MAX_SEATS,
    seats: Array.from({ length: MAX_SEATS }, () => null),
    dealerIndex: -1,
    smallBlindIndex: null,
    bigBlindIndex: null,
    smallBlind,
    bigBlind,
    deck: [],
    community: [],
    pot: 0,
    currentBet: 0,
    minRaise: bigBlind,
    currentPlayerIndex: null,
    pendingActionUserIds: [],
    street: "preflop",
    status: "waiting",
    handId: null,
    log: [toLog("Table created.")],
    lastUpdatedAt: new Date().toISOString(),
  };
};

const getAvailableSeatIndex = (table: PokerTable) =>
  table.seats.findIndex((seat) => seat === null);

const getPlayers = (table: PokerTable) =>
  table.seats.filter(Boolean) as PokerPlayer[];

const getActivePlayers = (table: PokerTable) =>
  getPlayers(table).filter(
    (player) => player.inHand && player.status !== "folded"
  );

const getEligiblePlayers = (table: PokerTable) =>
  getPlayers(table).filter((player) => player.chips > 0);

const getPlayerById = (table: PokerTable, userId: string) =>
  getPlayers(table).find((player) => player.userId === userId) ?? null;

const getSeatIndexByUserId = (table: PokerTable, userId: string) => {
  const player = getPlayerById(table, userId);
  return player ? player.seatIndex : null;
};

const markPlayerSeen = (table: PokerTable, userId: string) => {
  const player = getPlayerById(table, userId);
  if (!player) {
    return false;
  }
  player.lastSeenAt = new Date().toISOString();
  return true;
};

const nextOccupiedIndex = (table: PokerTable, fromIndex: number) => {
  for (let offset = 1; offset <= table.maxSeats; offset += 1) {
    const index = (fromIndex + offset) % table.maxSeats;
    const player = table.seats[index];
    if (player && player.chips > 0) {
      return index;
    }
  }
  return null;
};

const nextActiveIndex = (table: PokerTable, fromIndex: number) => {
  for (let offset = 1; offset <= table.maxSeats; offset += 1) {
    const index = (fromIndex + offset) % table.maxSeats;
    const player = table.seats[index];
    if (player && player.inHand && player.status === "active") {
      return index;
    }
  }
  return null;
};

const nextPendingIndex = (table: PokerTable, fromIndex: number) => {
  for (let offset = 1; offset <= table.maxSeats; offset += 1) {
    const index = (fromIndex + offset) % table.maxSeats;
    const player = table.seats[index];
    if (
      player &&
      player.inHand &&
      player.status === "active" &&
      table.pendingActionUserIds.includes(player.userId)
    ) {
      return index;
    }
  }
  return null;
};

const getBlindIndexes = (table: PokerTable) => {
  const activeSeats = getEligiblePlayers(table).map((player) => player.seatIndex);
  if (activeSeats.length === 2) {
    const dealerIndex = table.dealerIndex;
    const otherIndex = activeSeats.find((seat) => seat !== dealerIndex) ?? dealerIndex;
    return { smallBlindIndex: dealerIndex, bigBlindIndex: otherIndex };
  }

  const smallBlindIndex = nextOccupiedIndex(table, table.dealerIndex ?? -1);
  if (smallBlindIndex === null) {
    return { smallBlindIndex: null, bigBlindIndex: null };
  }
  const bigBlindIndex = nextOccupiedIndex(table, smallBlindIndex);
  return { smallBlindIndex, bigBlindIndex };
};

const resetBets = (table: PokerTable) => {
  getPlayers(table).forEach((player) => {
    player.bet = 0;
  });
};

const updatePendingActions = (table: PokerTable, raiserId?: string) => {
  const activePlayers = getPlayers(table).filter(
    (player) => player.inHand && player.status === "active"
  );
  if (raiserId) {
    table.pendingActionUserIds = activePlayers
      .filter((player) => player.userId !== raiserId)
      .map((player) => player.userId);
    return;
  }
  table.pendingActionUserIds = activePlayers.map((player) => player.userId);
};

const getCallAmount = (table: PokerTable, player: PokerPlayer) =>
  Math.max(0, table.currentBet - player.bet);

const postBlind = (table: PokerTable, seatIndex: number, amount: number) => {
  const player = table.seats[seatIndex];
  if (!player) {
    return;
  }
  const blind = Math.min(player.chips, amount);
  player.chips -= blind;
  player.bet += blind;
  player.totalBet += blind;
  table.pot += blind;
  if (player.chips === 0) {
    player.status = "all_in";
  }
};

const startHand = (table: PokerTable) => {
  const eligiblePlayers = getEligiblePlayers(table);
  if (eligiblePlayers.length < MIN_PLAYERS) {
    table.status = "waiting";
    table.smallBlindIndex = null;
    table.bigBlindIndex = null;
    return;
  }

  const nextDealer = nextOccupiedIndex(table, table.dealerIndex ?? -1);
  table.dealerIndex = nextDealer ?? eligiblePlayers[0].seatIndex;
  table.handId = randomUUID();
  table.status = "in_hand";
  table.street = "preflop";
  table.community = [];
  table.deck = createDeck();
  shuffleDeck(table.deck);
  table.pot = 0;
  table.currentBet = 0;
  table.minRaise = table.bigBlind;

  table.seats.forEach((seat) => {
    if (!seat) {
      return;
    }
    seat.inHand = seat.chips > 0;
    seat.status = seat.inHand ? "active" : "out";
    seat.bet = 0;
    seat.totalBet = 0;
    seat.cards = seat.inHand ? [drawCard(table), drawCard(table)] : [];
  });

  const { smallBlindIndex, bigBlindIndex } = getBlindIndexes(table);
  if (smallBlindIndex === null || bigBlindIndex === null) {
    table.status = "waiting";
    table.smallBlindIndex = null;
    table.bigBlindIndex = null;
    return;
  }
  table.smallBlindIndex = smallBlindIndex;
  table.bigBlindIndex = bigBlindIndex;

  postBlind(table, smallBlindIndex, table.smallBlind);
  postBlind(table, bigBlindIndex, table.bigBlind);

  table.currentBet = Math.max(
    table.seats[smallBlindIndex]?.bet ?? 0,
    table.seats[bigBlindIndex]?.bet ?? 0
  );
  table.minRaise = table.bigBlind;
  updatePendingActions(table);

  const headsUp = getEligiblePlayers(table).length === 2;
  const firstToAct = headsUp
    ? table.dealerIndex
    : nextActiveIndex(table, bigBlindIndex);
  table.currentPlayerIndex = firstToAct ?? table.dealerIndex;

  table.log.push(toLog(`New hand started.`));
  table.log.push(toLog(`Dealer is seat ${table.dealerIndex + 1}.`));

  if (allPlayersAllIn(table)) {
    dealToShowdown(table);
    concludeHand(table);
  }
};

const advanceStreet = (table: PokerTable) => {
  if (table.street === "preflop") {
    const flop = [drawCard(table), drawCard(table), drawCard(table)];
    table.community.push(...flop);
    table.street = "flop";
    table.log.push(toLog(`Flop: ${flop.join(" ")}.`));
  } else if (table.street === "flop") {
    const turn = drawCard(table);
    table.community.push(turn);
    table.street = "turn";
    table.log.push(toLog(`Turn: ${turn}.`));
  } else if (table.street === "turn") {
    const river = drawCard(table);
    table.community.push(river);
    table.street = "river";
    table.log.push(toLog(`River: ${river}.`));
  }

  resetBets(table);
  table.currentBet = 0;
  table.minRaise = table.bigBlind;
  updatePendingActions(table);

  const nextIndex = nextActiveIndex(table, table.dealerIndex);
  table.currentPlayerIndex = nextIndex ?? table.dealerIndex;
};

const allPlayersAllIn = (table: PokerTable) => {
  const active = getActivePlayers(table);
  return active.length > 0 && active.every((player) => player.status === "all_in");
};

const dealToShowdown = (table: PokerTable) => {
  while (table.street !== "river") {
    advanceStreet(table);
  }
  table.street = "showdown";
};

const buildSidePots = (players: PokerPlayer[]): SidePot[] => {
  const eligible = players.filter((player) => player.totalBet > 0);
  if (!eligible.length) {
    return [];
  }
  const sorted = [...eligible].sort((a, b) => a.totalBet - b.totalBet);
  const uniqueLevels = Array.from(new Set(sorted.map((player) => player.totalBet)));
  let remaining = [...eligible];
  let previous = 0;
  const pots: SidePot[] = [];

  uniqueLevels.forEach((level) => {
    const increment = level - previous;
    const potAmount = increment * remaining.length;
    const eligibleUserIds = remaining
      .filter((player) => player.status !== "folded")
      .map((player) => player.userId);
    pots.push({ amount: potAmount, eligibleUserIds });
    remaining = remaining.filter((player) => player.totalBet > level);
    previous = level;
  });

  return pots;
};

const distributePot = (
  table: PokerTable,
  pot: SidePot,
  winners: PokerPlayer[]
) => {
  if (!winners.length || pot.amount <= 0) {
    return;
  }
  const split = Math.floor(pot.amount / winners.length);
  const remainder = pot.amount - split * winners.length;
  winners.forEach((winner) => {
    winner.chips += split;
  });
  if (remainder > 0) {
    const orderedWinners = [...winners].sort(
      (a, b) => a.seatIndex - b.seatIndex
    );
    orderedWinners[0].chips += remainder;
  }
};

const resolveShowdown = (table: PokerTable) => {
  table.street = "showdown";
  const players = getPlayers(table);
  const activePlayers = players.filter((player) => player.status !== "folded");
  if (activePlayers.length === 1) {
    const winner = activePlayers[0];
    winner.chips += table.pot;
    table.log.push(toLog(`${winner.name} wins ${table.pot}.`));
    table.pot = 0;
    return;
  }

  const pots = buildSidePots(players);
  if (!pots.length) {
    return;
  }

  pots.forEach((pot) => {
    const eligiblePlayers = players.filter((player) =>
      pot.eligibleUserIds.includes(player.userId)
    );
    const hands = eligiblePlayers.map((player) => ({
      player,
      hand: evaluateBestHand([...player.cards, ...table.community]),
    }));
    let best: PokerHandRank | null = null;
    hands.forEach(({ hand }) => {
      if (!best || compareHands(hand, best) > 0) {
        best = hand;
      }
    });
    const winners = hands
      .filter(({ hand }) => best && compareHands(hand, best) === 0)
      .map(({ player }) => player);
    distributePot(table, pot, winners);
    if (winners.length === 1) {
      table.log.push(toLog(`${winners[0].name} wins ${pot.amount}.`));
    } else {
      table.log.push(
        toLog(`Split pot (${pot.amount}) between ${winners.map((w) => w.name).join(", ")}.`)
      );
    }
  });

  table.pot = 0;
};

const concludeHand = (table: PokerTable) => {
  resolveShowdown(table);
  table.status = "waiting";
  table.handId = null;
  table.currentPlayerIndex = null;
  table.pendingActionUserIds = [];
  table.currentBet = 0;
  table.minRaise = table.bigBlind;
  table.smallBlindIndex = null;
  table.bigBlindIndex = null;

  table.seats = table.seats.map((seat) => {
    if (!seat) {
      return null;
    }
    if (seat.pendingLeave) {
      return null;
    }
    return seat;
  });

  table.seats.forEach((seat) => {
    if (!seat) {
      return;
    }
    seat.pendingLeave = undefined;
    seat.inHand = false;
    seat.bet = 0;
    seat.totalBet = 0;
    seat.cards = [];
    seat.status = seat.chips > 0 ? "active" : "out";
  });

  const eligible = getEligiblePlayers(table);
  if (eligible.length >= MIN_PLAYERS) {
    startHand(table);
  }
};

const maybeAwardIfSingle = (table: PokerTable) => {
  const active = getActivePlayers(table);
  if (active.length === 1) {
    const winner = active[0];
    winner.chips += table.pot;
    table.log.push(toLog(`${winner.name} wins ${table.pot}.`));
    table.pot = 0;
    concludeHand(table);
    return true;
  }
  return false;
};

const applyPlayerAction = (table: PokerTable, player: PokerPlayer, action: PokerAction) => {
  const callAmount = getCallAmount(table, player);
  if (action.action === "fold") {
    player.status = "folded";
    table.pendingActionUserIds = table.pendingActionUserIds.filter(
      (id) => id !== player.userId
    );
    table.log.push(toLog(`${player.name} folds.`));
    return;
  }

  if (action.action === "check") {
    if (callAmount > 0) {
      throw new PokerError("You cannot check when facing a bet.", 400);
    }
    table.pendingActionUserIds = table.pendingActionUserIds.filter(
      (id) => id !== player.userId
    );
    table.log.push(toLog(`${player.name} checks.`));
    return;
  }

  if (action.action === "call") {
    const toCall = Math.min(callAmount, player.chips);
    player.chips -= toCall;
    player.bet += toCall;
    player.totalBet += toCall;
    table.pot += toCall;
    if (player.chips === 0) {
      player.status = "all_in";
    }
    table.pendingActionUserIds = table.pendingActionUserIds.filter(
      (id) => id !== player.userId
    );
    table.log.push(toLog(`${player.name} calls ${toCall}.`));
    return;
  }

  if (action.action === "bet" || action.action === "raise") {
    const amount = action.amount;
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PokerError("Enter a valid bet amount.", 400);
    }
    if (action.action === "bet" && table.currentBet > 0) {
      throw new PokerError("You cannot bet after a raise. Try calling or raising.", 400);
    }
    if (action.action === "raise" && table.currentBet === 0) {
      throw new PokerError("You cannot raise without a bet.", 400);
    }

    const total = callAmount + amount;
    const wager = Math.min(total, player.chips);
    player.chips -= wager;
    player.bet += wager;
    player.totalBet += wager;
    table.pot += wager;

    if (player.chips === 0) {
      player.status = "all_in";
    }

    if (player.bet <= table.currentBet) {
      table.pendingActionUserIds = table.pendingActionUserIds.filter(
        (id) => id !== player.userId
      );
      table.log.push(toLog(`${player.name} calls all-in for ${wager}.`));
      return;
    }

    if (player.bet > table.currentBet) {
      const raiseAmount = player.bet - table.currentBet;
      if (raiseAmount >= table.minRaise) {
        table.minRaise = raiseAmount;
      }
      table.currentBet = player.bet;
      updatePendingActions(table, player.userId);
    }

    table.log.push(
      toLog(
        `${player.name} ${action.action === "bet" ? "bets" : "raises"} ${wager}.`
      )
    );
    return;
  }
};

const ensureBettingRound = (table: PokerTable) => {
  if (!table.pendingActionUserIds.length) {
    if (table.street === "river") {
      table.street = "showdown";
      concludeHand(table);
      return { advanced: true };
    }
    advanceStreet(table);
    return { advanced: true };
  }

  if (allPlayersAllIn(table)) {
    dealToShowdown(table);
    concludeHand(table);
    return { advanced: true };
  }

  return { advanced: false };
};

const updateCurrentPlayer = (table: PokerTable, fromIndex: number) => {
  const nextIndex = nextPendingIndex(table, fromIndex);
  table.currentPlayerIndex = nextIndex;
};

const removePlayerFromTable = (table: PokerTable, player: PokerPlayer, reason: string) => {
  const wasCurrent = table.currentPlayerIndex === player.seatIndex;

  if (table.status === "in_hand" && player.inHand) {
    player.pendingLeave = true;
    if (player.status === "active") {
      player.status = "folded";
      table.pendingActionUserIds = table.pendingActionUserIds.filter(
        (id) => id !== player.userId
      );
      table.log.push(toLog(reason));

      if (!maybeAwardIfSingle(table)) {
        const roundResult = ensureBettingRound(table);
        if (
          !roundResult.advanced &&
          table.status === "in_hand" &&
          table.pendingActionUserIds.length
        ) {
          updateCurrentPlayer(table, player.seatIndex);
        }
      }
    } else {
      table.log.push(toLog(reason));
    }
  } else {
    table.seats[player.seatIndex] = null;
    table.log.push(toLog(reason));
  }

  if (wasCurrent && table.currentPlayerIndex === player.seatIndex) {
    updateCurrentPlayer(table, player.seatIndex);
  }
};

const buildClientState = (table: PokerTable, userId: string): PokerClientState => {
  const youSeatIndex = getSeatIndexByUserId(table, userId);
  const youSeat = youSeatIndex !== null ? table.seats[youSeatIndex] : null;
  const shouldHideSeat = (seat: PokerPlayer) =>
    (seat.pendingLeave && seat.status !== "all_in") ||
    seat.status === "out" ||
    (seat.chips <= 0 && !seat.inHand);
  const hideYouSeat = youSeat ? shouldHideSeat(youSeat) : false;
  const seats: Array<PokerClientSeat | null> = table.seats.map((seat, index) => {
    if (!seat) {
      return null;
    }
    if (shouldHideSeat(seat)) {
      return null;
    }
    const showCards =
      table.street === "showdown" || seat.userId === userId || table.status !== "in_hand";
    return {
      seatIndex: index,
      userId: seat.userId,
      name: seat.name,
      handle: seat.handle,
      chips: seat.chips,
      bet: seat.bet,
      status: seat.status,
      isDealer: index === table.dealerIndex,
      cards: showCards ? seat.cards : undefined,
    };
  });

  const effectiveYouSeatIndex =
    youSeatIndex !== null && !hideYouSeat ? youSeatIndex : null;
  const you = effectiveYouSeatIndex !== null ? table.seats[effectiveYouSeatIndex] : null;
  const actions = (() => {
    if (!you || !you.inHand || you.status !== "active") {
      return undefined;
    }
    if (table.currentPlayerIndex !== you.seatIndex) {
      return undefined;
    }
    const callAmount = getCallAmount(table, you);
    const maxRaise = Math.max(0, you.chips - callAmount);
    return {
      canCheck: callAmount === 0,
      canCall: callAmount > 0 && you.chips > 0,
      canBet: table.currentBet === 0 && you.chips > 0,
      canRaise: table.currentBet > 0 && you.chips > callAmount,
      callAmount,
      minRaise: table.minRaise,
      maxRaise,
    };
  })();

  return {
    tableId: table.id,
    status: table.status,
    street: table.street,
    pot: table.pot,
    community: table.community,
    seats,
    currentPlayerIndex: table.currentPlayerIndex,
    currentBet: table.currentBet,
    minRaise: table.minRaise,
    smallBlindIndex: table.smallBlindIndex ?? null,
    bigBlindIndex: table.bigBlindIndex ?? null,
    youSeatIndex: effectiveYouSeatIndex,
    actions,
    log: table.log.slice(-12),
  };
};

const ensureBuyIn = async (userId: string, amount: number) => {
  await ensureUsersTable();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PokerError("Enter a valid buy-in amount.", 400);
  }
  const result = await db.query(
    `UPDATE users
     SET coins = COALESCE(coins, 0) - $2
     WHERE id = $1
       AND COALESCE(coins, 0) >= $2
     RETURNING coins`,
    [userId, amount]
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new PokerError("Not enough coins for that buy-in.", 400);
  }
  return Number(result.rows[0]?.coins ?? 0);
};

const seatPlayerAtTable = async (
  table: PokerTable,
  entry: PokerQueueEntry,
  amountOverride?: number
) => {
  const seatIndex = getAvailableSeatIndex(table);
  if (seatIndex === -1) {
    throw new PokerError("No seats available.", 409);
  }
  const buyInAmount = amountOverride ?? entry.amount;
  await ensureBuyIn(entry.userId, buyInAmount);
  const player: PokerPlayer = {
    userId: entry.userId,
    name: entry.name,
    handle: normalizeHandle(entry.handle),
    chips: buyInAmount,
    seatIndex,
    inHand: false,
    status: "active",
    bet: 0,
    totalBet: 0,
    cards: [],
    lastSeenAt: new Date().toISOString(),
  };
  table.seats[seatIndex] = player;
  table.log.push(toLog(`${player.name} joined the table.`));
  await setPlayerTableId(entry.userId, table.id);
};

const processQueue = async () => {
  const queueEntries = await readQueueEntries();
  if (!queueEntries.length) {
    return { updatedTableIds: [] as string[], failedUserIds: [] as string[] };
  }

  const tables = await loadActiveTables();
  const updatedTableIds = new Set<string>();
  const failedUserIds: string[] = [];

  for (const entry of queueEntries) {
    const existingTableId = await getPlayerTableId(entry.userId);
    if (existingTableId) {
      await dequeuePlayer(entry.userId);
      continue;
    }

    let table = tables.find((candidate) => getAvailableSeatIndex(candidate) !== -1);
    if (!table) {
      if (tables.length >= MAX_TABLES) {
        break;
      }
      const bigBlind = Math.max(2, Math.floor(entry.amount * 0.05));
      const smallBlind = Math.max(1, Math.floor(bigBlind / 2));
      table = createTable(smallBlind, bigBlind);
      tables.push(table);
    }

    try {
      await seatPlayerAtTable(table, entry);
    } catch (error) {
      if (error instanceof PokerError && error.status === 409) {
        continue;
      }
      failedUserIds.push(entry.userId);
      await dequeuePlayer(entry.userId);
      continue;
    }

    if (table.status === "waiting") {
      const eligible = getEligiblePlayers(table);
      if (eligible.length >= MIN_PLAYERS) {
        startHand(table);
      }
    }

    await saveTable(table);
    updatedTableIds.add(table.id);
    await dequeuePlayer(entry.userId);
  }

  return { updatedTableIds: Array.from(updatedTableIds), failedUserIds };
};

export const queuePokerPlayer = async (params: {
  userId: string;
  name: string;
  handle?: string | null;
  amount?: number;
}) => {
  const normalizedAmount = params.amount ? Math.floor(params.amount) : 0;
  const existingTableId = await getPlayerTableId(params.userId);
  let table = existingTableId ? await loadTable(existingTableId) : null;

  if (table) {
    const player = getPlayerById(table, params.userId);
    if (!player) {
      await clearPlayerTableId(params.userId);
      table = null;
    } else {
      player.lastSeenAt = new Date().toISOString();
      if (normalizedAmount) {
        await ensureBuyIn(params.userId, normalizedAmount);
        player.chips += normalizedAmount;
        if (player.status === "out" && player.chips > 0) {
          player.status = "active";
        }
        table.log.push(toLog(`${player.name} re-bought ${normalizedAmount} chips.`));
      }
      if (table.status === "waiting") {
        const eligible = getEligiblePlayers(table);
        if (eligible.length >= MIN_PLAYERS) {
          startHand(table);
        }
      }
      await saveTable(table);
      return {
        tableId: table.id,
        state: buildClientState(table, params.userId),
        queued: false,
        queuePosition: null,
        updatedTableIds: [table.id],
      };
    }
  }

  if (!normalizedAmount) {
    throw new PokerError("Buy in to join a table.", 400);
  }

  const queuePosition = await enqueuePlayer({
    userId: params.userId,
    name: params.name,
    handle: normalizeHandle(params.handle),
    amount: normalizedAmount,
    enqueuedAt: Date.now(),
  });

  const { updatedTableIds, failedUserIds } = await processQueue();
  if (failedUserIds.includes(params.userId)) {
    throw new PokerError("Not enough coins for that buy-in.", 400);
  }

  const seatedTableId = await getPlayerTableId(params.userId);
  if (seatedTableId) {
    const seatedTable = await loadTable(seatedTableId);
    if (seatedTable) {
      return {
        tableId: seatedTableId,
        state: buildClientState(seatedTable, params.userId),
        queued: false,
        queuePosition: null,
        updatedTableIds,
      };
    }
  }

  const position = (await getQueuePosition(params.userId)) ?? queuePosition ?? null;
  return {
    tableId: null,
    state: null,
    queued: true,
    queuePosition: position,
    updatedTableIds,
  };
};

export const getPokerStateForUser = async (userId: string) => {
  const tableId = await getPlayerTableId(userId);
  if (!tableId) {
    const queuePosition = await getQueuePosition(userId);
    return {
      tableId: null,
      state: null,
      queued: queuePosition !== null,
      queuePosition,
    } as const;
  }
  const table = await loadTable(tableId);
  if (!table) {
    await clearPlayerTableId(userId);
    const queuePosition = await getQueuePosition(userId);
    return {
      tableId: null,
      state: null,
      queued: queuePosition !== null,
      queuePosition,
    } as const;
  }
  const touched = markPlayerSeen(table, userId);
  if (touched) {
    await saveTable(table);
  }
  return {
    tableId,
    state: buildClientState(table, userId),
    queued: false,
    queuePosition: null,
  } as const;
};

export const touchPokerPlayer = async (userId: string) => {
  const tableId = await getPlayerTableId(userId);
  if (!tableId) {
    return false;
  }
  const table = await loadTable(tableId);
  if (!table) {
    await clearPlayerTableId(userId);
    return false;
  }
  const touched = markPlayerSeen(table, userId);
  if (touched) {
    await saveTable(table);
  }
  return touched;
};

export const applyPokerAction = async (params: {
  userId: string;
  action: PokerAction;
}) => {
  const tableId = await getPlayerTableId(params.userId);
  if (!tableId) {
    throw new PokerError("Join a table first.", 400);
  }
  const table = await loadTable(tableId);
  if (!table) {
    await clearPlayerTableId(params.userId);
    throw new PokerError("Table not found.", 404);
  }

  if (table.status !== "in_hand") {
    throw new PokerError("No active hand yet.", 400);
  }

  const player = getPlayerById(table, params.userId);
  if (!player || !player.inHand) {
    throw new PokerError("You are not in this hand.", 400);
  }
  if (player.status !== "active") {
    throw new PokerError("You cannot act right now.", 400);
  }

  if (table.currentPlayerIndex !== player.seatIndex) {
    throw new PokerError("Waiting for your turn.", 400);
  }

  player.lastSeenAt = new Date().toISOString();
  applyPlayerAction(table, player, params.action);

  if (!maybeAwardIfSingle(table)) {
    const roundResult = ensureBettingRound(table);
    if (
      !roundResult.advanced &&
      table.status === "in_hand" &&
      table.pendingActionUserIds.length
    ) {
      updateCurrentPlayer(table, player.seatIndex);
    }
  }

  await saveTable(table);
  let updatedTableIds = [table.id];
  let failedUserIds: string[] = [];
  if ((await getQueueLength()) > 0) {
    const queueResult = await processQueue();
    updatedTableIds = Array.from(
      new Set([...updatedTableIds, ...queueResult.updatedTableIds])
    );
    failedUserIds = queueResult.failedUserIds;
  }

  const refreshedTable =
    updatedTableIds.includes(table.id) ? await loadTable(table.id) : table;
  const state = refreshedTable
    ? buildClientState(refreshedTable, params.userId)
    : buildClientState(table, params.userId);

  return { tableId: table.id, state, updatedTableIds, failedUserIds };
};

export const rebuyPoker = async (params: {
  userId: string;
  amount: number;
}) => {
  const tableId = await getPlayerTableId(params.userId);
  if (!tableId) {
    throw new PokerError("Join a table before re-buying.", 400);
  }
  const table = await loadTable(tableId);
  if (!table) {
    await clearPlayerTableId(params.userId);
    throw new PokerError("Table not found.", 404);
  }

  const player = getPlayerById(table, params.userId);
  if (!player) {
    throw new PokerError("Player not seated.", 400);
  }

  player.lastSeenAt = new Date().toISOString();
  const amount = Math.floor(params.amount);
  await ensureBuyIn(params.userId, amount);
  player.chips += amount;
  if (player.status === "out" && player.chips > 0) {
    player.status = "active";
  }
  table.log.push(toLog(`${player.name} re-bought ${amount} chips.`));

  if (table.status === "waiting") {
    const eligible = getEligiblePlayers(table);
    if (eligible.length >= MIN_PLAYERS) {
      startHand(table);
    }
  }

  await saveTable(table);
  return { tableId: table.id, state: buildClientState(table, params.userId) };
};

export const leavePokerTable = async (userId: string) => {
  const tableId = await getPlayerTableId(userId);
  if (!tableId) {
    await dequeuePlayer(userId);
    const queuePosition = await getQueuePosition(userId);
    return {
      tableId: null,
      state: null,
      queued: queuePosition !== null,
      queuePosition,
      updatedTableIds: [],
      failedUserIds: [],
    } as const;
  }

  const table = await loadTable(tableId);
  if (!table) {
    await clearPlayerTableId(userId);
    const queuePosition = await getQueuePosition(userId);
    return {
      tableId: null,
      state: null,
      queued: queuePosition !== null,
      queuePosition,
      updatedTableIds: [],
      failedUserIds: [],
    } as const;
  }

  const player = getPlayerById(table, userId);
  if (!player) {
    await clearPlayerTableId(userId);
    const queuePosition = await getQueuePosition(userId);
    return {
      tableId: null,
      state: null,
      queued: queuePosition !== null,
      queuePosition,
      updatedTableIds: [],
      failedUserIds: [],
    } as const;
  }

  await dequeuePlayer(userId);
  removePlayerFromTable(table, player, `${player.name} left the table.`);
  await clearPlayerTableId(userId);

  await saveTable(table);

  let updatedTableIds = [table.id];
  let failedUserIds: string[] = [];
  if ((await getQueueLength()) > 0) {
    const queueResult = await processQueue();
    updatedTableIds = Array.from(
      new Set([...updatedTableIds, ...queueResult.updatedTableIds])
    );
    failedUserIds = queueResult.failedUserIds;
  }

  return {
    tableId: null,
    state: null,
    queued: false,
    queuePosition: null,
    updatedTableIds,
    failedUserIds,
  } as const;
};

export const forceRemovePokerUser = async (userId: string, reason?: string) => {
  const tableId = await getPlayerTableId(userId);
  if (tableId) {
    return leavePokerTable(userId);
  }

  const tables = await loadActiveTables();
  for (const table of tables) {
    const player = getPlayerById(table, userId);
    if (!player) {
      continue;
    }
    removePlayerFromTable(
      table,
      player,
      reason ?? `${player.name} left the table.`
    );
    await clearPlayerTableId(userId);
    await saveTable(table);

    let updatedTableIds = [table.id];
    let failedUserIds: string[] = [];
    if ((await getQueueLength()) > 0) {
      const queueResult = await processQueue();
      updatedTableIds = Array.from(
        new Set([...updatedTableIds, ...queueResult.updatedTableIds])
      );
      failedUserIds = queueResult.failedUserIds;
    }

    return {
      tableId: null,
      state: null,
      queued: false,
      queuePosition: null,
      updatedTableIds,
      failedUserIds,
    } as const;
  }

  await dequeuePlayer(userId);
  return {
    tableId: null,
    state: null,
    queued: false,
    queuePosition: null,
    updatedTableIds: [],
    failedUserIds: [],
  } as const;
};

export const prunePokerTables = async (params: {
  inactivityMs: number;
  isUserActive?: (userId: string) => boolean;
}) => {
  const { inactivityMs, isUserActive } = params;
  const now = Date.now();
  const tables = await loadActiveTables();
  const updatedTableIds = new Set<string>();
  const removedUserIds: string[] = [];

  for (const table of tables) {
    const staleTargets: Array<{ userId: string; reason: string }> = [];
    for (const seat of table.seats) {
      if (!seat) {
        continue;
      }
      const lastSeenMs = seat.lastSeenAt ? Date.parse(seat.lastSeenAt) : Number.NaN;
      const active = isUserActive ? isUserActive(seat.userId) : false;
      const hasSeen = Number.isFinite(lastSeenMs);
      const isStale =
        !active && (hasSeen ? now - lastSeenMs > inactivityMs : true);
      const isBroke = seat.chips <= 0 && (!seat.inHand || table.status !== "in_hand");
      if (isStale || isBroke) {
        staleTargets.push({
          userId: seat.userId,
          reason: isBroke
            ? `${seat.name} busted out.`
            : `${seat.name} left the table.`,
        });
      }
    }

    if (!staleTargets.length) {
      continue;
    }

    let changed = false;
    for (const target of staleTargets) {
      const player = getPlayerById(table, target.userId);
      if (!player) {
        continue;
      }
      removePlayerFromTable(table, player, target.reason);
      await clearPlayerTableId(target.userId);
      removedUserIds.push(target.userId);
      changed = true;
    }

    if (changed && table.status === "waiting") {
      const eligible = getEligiblePlayers(table);
      if (eligible.length >= MIN_PLAYERS) {
        startHand(table);
      }
    }

    if (changed) {
      await saveTable(table);
      updatedTableIds.add(table.id);
    }
  }

  let failedUserIds: string[] = [];
  if ((await getQueueLength()) > 0) {
    const queueResult = await processQueue();
    queueResult.updatedTableIds.forEach((id) => updatedTableIds.add(id));
    failedUserIds = queueResult.failedUserIds;
  }

  return {
    updatedTableIds: Array.from(updatedTableIds),
    failedUserIds,
    removedUserIds,
  };
};

export const getPokerStatesForTable = async (tableId: string) => {
  const table = await loadTable(tableId);
  if (!table) {
    return [] as Array<{ userId: string; state: PokerClientState }>;
  }
  return getPlayers(table).map((player) => ({
    userId: player.userId,
    state: buildClientState(table, player.userId),
  }));
};
