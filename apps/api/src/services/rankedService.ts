import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { db } from "../db";
import { ensureUsersTable } from "./authService";
import { getWordsByLength } from "./wordDictionary";
import type { MessageUser } from "./messageService";

export type RankedStatus =
  | {
      status: "matched";
      matchId: string;
      opponents: MessageUser[];
      startedAt: string;
      lives: { me: number; opponents: number[] };
      turnStartedAt: string;
      serverTime: string;
      isMyTurn: boolean;
      currentTurnUserId: string | null;
      isJudge: boolean;
      judgeUserId: string | null;
      icebreakerQuestion?: string | null;
      characterRole?: string | null;
      characterRoleAssignedAt?: string | null;
    }
  | { status: "waiting" }
  | { status: "idle" };

export type RankedMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: MessageUser;
  edited?: boolean;
};

const rankedMatchColumns = `
  id,
  user_a_id,
  user_b_id,
  user_c_id,
  started_at,
  timed_out,
  user_a_lives,
  user_b_lives,
  user_c_lives,
  turn_started_at,
  current_turn_user_id,
  judge_user_id,
  user_a_typing,
  user_b_typing,
  user_c_typing,
  user_a_typing_at,
  user_b_typing_at,
  user_c_typing_at,
  icebreaker_question,
  character_role_a,
  character_role_b,
  character_role_assigned_at_a,
  character_role_assigned_at_b,
  typing_test_round,
  typing_test_state,
  typing_test_started_at,
  typing_test_words,
  typing_test_winner_id,
  typing_test_result_at
`;

const DEFAULT_LIVES = 3;
const TURN_SECONDS = 15;
const WIN_REWARD_COINS = 100;
const TYPING_TEST_TRIGGER_MESSAGES = 10;
const TYPING_TEST_WORD_COUNT = 10;
const TYPING_TEST_COUNTDOWN_SECONDS = 3;
const TYPING_TEST_RESULT_SECONDS = 3;
const TYPING_TEST_MIN_WORD_LENGTH = 3;
const TYPING_TEST_MAX_WORD_LENGTH = 8;

const icebreakerCache: { value: string[] | null } = { value: null };
const characterRoleCache: {
  value: string[] | null;
  mtimeMs: number | null;
  path: string | null;
} = { value: null, mtimeMs: null, path: null };

const getIcebreakerPath = () => {
  const candidates = [
    process.env.ICEBREAKER_QUESTIONS_PATH,
    path.resolve(process.cwd(), "GameQuestions.csv"),
    path.resolve(process.cwd(), "apps", "api", "GameQuestions.csv"),
    path.resolve(process.cwd(), "..", "GameQuestions.csv"),
    path.resolve(process.cwd(), "..", "..", "GameQuestions.csv"),
    path.resolve(process.cwd(), "..", "..", "..", "GameQuestions.csv"),
    path.resolve(__dirname, "..", "..", "..", "GameQuestions.csv"),
    path.resolve(__dirname, "..", "..", "..", "..", "GameQuestions.csv"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const getCharacterRolesPath = () => {
  const candidates = [
    process.env.CHARACTER_ROLES_PATH,
    path.resolve(process.cwd(), "characters.csv"),
    path.resolve(process.cwd(), "apps", "api", "characters.csv"),
    path.resolve(process.cwd(), "..", "characters.csv"),
    path.resolve(process.cwd(), "..", "..", "characters.csv"),
    path.resolve(process.cwd(), "..", "..", "..", "characters.csv"),
    path.resolve(__dirname, "..", "..", "..", "characters.csv"),
    path.resolve(__dirname, "..", "..", "..", "..", "characters.csv"),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
};

const loadIcebreakerQuestions = () => {
  if (icebreakerCache.value && icebreakerCache.value.length > 0) {
    return icebreakerCache.value;
  }
  const filePath = getIcebreakerPath();
  if (!filePath) {
    icebreakerCache.value = [];
    return icebreakerCache.value;
  }
  const raw = fs.readFileSync(filePath, "utf8");
  const questions: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let question = trimmed;
    if (question.startsWith("\"") && question.endsWith("\"")) {
      question = question.slice(1, -1).replace(/""/g, "\"");
    }
    if (question) {
      questions.push(question);
    }
  }
  icebreakerCache.value = questions;
  return questions;
};

const loadCharacterRoles = () => {
  const filePath = getCharacterRolesPath();
  if (!filePath) {
    characterRoleCache.value = [];
    characterRoleCache.mtimeMs = null;
    characterRoleCache.path = null;
    return characterRoleCache.value;
  }
  let stat: fs.Stats | null = null;
  try {
    stat = fs.statSync(filePath);
  } catch {
    stat = null;
  }
  if (
    stat &&
    characterRoleCache.value &&
    characterRoleCache.path === filePath &&
    characterRoleCache.mtimeMs === stat.mtimeMs
  ) {
    return characterRoleCache.value;
  }
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    raw = "";
  }
  const roles: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let role = trimmed;
    if (role.startsWith("\"") && role.endsWith("\"")) {
      role = role.slice(1, -1).replace(/""/g, "\"");
    }
    if (role) {
      roles.push(role);
    }
  }
  // Drop a simple header if present.
  if (roles.length > 1 && roles[0]?.toLowerCase().includes("role")) {
    roles.shift();
  }
  characterRoleCache.value = roles;
  characterRoleCache.mtimeMs = stat ? stat.mtimeMs : null;
  characterRoleCache.path = filePath;
  return roles;
};

const pickIcebreakerQuestion = () => {
  const questions = loadIcebreakerQuestions();
  if (questions.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * questions.length);
  return questions[index] ?? null;
};

const pickCharacterRole = () => {
  const roles = loadCharacterRoles();
  if (roles.length === 0) {
    return null;
  }
  const index = Math.floor(Math.random() * roles.length);
  return roles[index] ?? null;
};

const ensureIcebreakerQuestion = async (
  match: RankedMatchRow
): Promise<RankedMatchRow> => {
  if (match.icebreaker_question) {
    return match;
  }
  const question = pickIcebreakerQuestion();
  if (!question) {
    return match;
  }
  const updated = await db.query(
    `UPDATE ranked_matches
     SET icebreaker_question = $2
     WHERE id = $1 AND icebreaker_question IS NULL
     RETURNING ${rankedMatchColumns}`,
    [match.id, question]
  );
  if ((updated.rowCount ?? 0) > 0) {
    return updated.rows[0] as RankedMatchRow;
  }
  return { ...match, icebreaker_question: question };
};

const ensureCharacterRole = async (
  match: RankedMatchRow
): Promise<RankedMatchRow> => {
  let currentMatch = match;
  if (typeof currentMatch.character_role_a === "undefined") {
    const refreshed = await getMatch(currentMatch.id);
    if (refreshed) {
      currentMatch = refreshed;
    }
  }
  const roleA = currentMatch.character_role_a ?? pickCharacterRole();
  const roleB = currentMatch.character_role_b ?? pickCharacterRole();
  if (!roleA || !roleB) {
    return currentMatch;
  }
  const updated = await db.query(
    `UPDATE ranked_matches
     SET character_role_a = COALESCE(character_role_a, $2),
         character_role_b = COALESCE(character_role_b, $3),
         character_role_assigned_at_a = COALESCE(character_role_assigned_at_a, now()),
         character_role_assigned_at_b = COALESCE(character_role_assigned_at_b, now())
     WHERE id = $1
     RETURNING ${rankedMatchColumns}`,
    [currentMatch.id, roleA, roleB]
  );
  if ((updated.rowCount ?? 0) > 0) {
    return updated.rows[0] as RankedMatchRow;
  }
  return {
    ...currentMatch,
    character_role_a: roleA,
    character_role_b: roleB,
    character_role_assigned_at_a:
      currentMatch.character_role_assigned_at_a ?? new Date().toISOString(),
    character_role_assigned_at_b:
      currentMatch.character_role_assigned_at_b ?? new Date().toISOString(),
  };
};

type RankedMatchRow = {
  id: string;
  user_a_id: string;
  user_b_id: string;
  user_c_id?: string | null;
  started_at: string | Date;
  timed_out: boolean;
  user_a_lives: number;
  user_b_lives: number;
  user_c_lives?: number;
  turn_started_at: string | Date;
  current_turn_user_id: string | null;
  user_a_typing: string | null;
  user_b_typing: string | null;
  user_c_typing?: string | null;
  user_a_typing_at: string | Date | null;
  user_b_typing_at: string | Date | null;
  user_c_typing_at?: string | Date | null;
  icebreaker_question?: string | null;
  character_role_a?: string | null;
  character_role_b?: string | null;
  character_role_assigned_at_a?: string | Date | null;
  character_role_assigned_at_b?: string | Date | null;
  judge_user_id?: string | null;
  typing_test_round?: number;
  typing_test_state?: string | null;
  typing_test_started_at?: string | Date | null;
  typing_test_words?: unknown;
  typing_test_winner_id?: string | null;
  typing_test_result_at?: string | Date | null;
};

type TypingTestState = "countdown" | "active" | "result";

type TypingTestPayload = {
  state: "idle" | TypingTestState;
  words: string[];
  startedAt?: string;
  resultAt?: string;
  winnerId?: string | null;
  round: number;
};

const mapUser = (row: { id: string; name: string; handle: string }): MessageUser => ({
  id: row.id,
  name: row.name,
  handle: row.handle,
});

const getOpponentIds = (match: RankedMatchRow, userId: string) =>
  [match.user_a_id, match.user_b_id, match.user_c_id].filter(
    (id): id is string => Boolean(id && id !== userId)
  );

const getLivesForUser = (match: RankedMatchRow, userId: string) => {
  if (match.user_a_id === userId) return match.user_a_lives;
  if (match.user_b_id === userId) return match.user_b_lives;
  if (match.user_c_id === userId) return match.user_c_lives ?? DEFAULT_LIVES;
  return DEFAULT_LIVES;
};

const getActiveOpponentId = (match: RankedMatchRow, userId: string) => {
  if (match.judge_user_id && match.judge_user_id === userId) {
    return match.current_turn_user_id ?? match.user_a_id;
  }
  if (match.user_a_id === userId) return match.user_b_id;
  if (match.user_b_id === userId) return match.user_a_id;
  return match.current_turn_user_id ?? match.user_a_id;
};

const getTypingForUserId = (match: RankedMatchRow, userId: string | null) => {
  if (!userId) {
    return { text: null as string | null, at: null as string | Date | null };
  }
  if (userId === match.user_a_id) {
    return { text: match.user_a_typing, at: match.user_a_typing_at };
  }
  if (userId === match.user_b_id) {
    return { text: match.user_b_typing, at: match.user_b_typing_at };
  }
  if (userId === match.user_c_id) {
    return { text: match.user_c_typing ?? null, at: match.user_c_typing_at ?? null };
  }
  return { text: null, at: null };
};

const getCharacterRoleForUser = (
  match: RankedMatchRow,
  userId: string
): { role: string | null; assignedAt: string | null } => {
  if (match.judge_user_id && match.judge_user_id === userId) {
    const assignedAt = match.started_at
      ? parseTimestamp(match.started_at).toISOString()
      : null;
    return { role: null, assignedAt };
  }
  if (userId !== match.user_a_id && userId !== match.user_b_id) {
    return { role: null, assignedAt: null };
  }
  const isUserA = match.user_a_id === userId;
  const role = isUserA ? match.character_role_a ?? null : match.character_role_b ?? null;
  const assignedAtRaw = isUserA
    ? match.character_role_assigned_at_a
    : match.character_role_assigned_at_b;
  const assignedAt = assignedAtRaw ? parseTimestamp(assignedAtRaw).toISOString() : null;
  return { role, assignedAt };
};

const getOpponentsForUser = async (
  match: RankedMatchRow,
  userId: string
): Promise<{ opponents: MessageUser[]; opponentLives: number[] }> => {
  const opponentIds = getOpponentIds(match, userId);
  const opponents = await Promise.all(opponentIds.map((id) => fetchUserById(id)));
  const opponentLives = opponentIds.map((id) => getLivesForUser(match, id));
  return { opponents, opponentLives };
};

const getNextTurnUserId = (match: RankedMatchRow, currentId: string | null) => {
  const order = [match.user_a_id, match.user_b_id].filter(Boolean) as string[];
  if (order.length === 0) {
    return currentId;
  }
  if (!currentId) {
    return order[0];
  }
  const index = order.indexOf(currentId);
  if (index === -1) {
    return order[0];
  }
  return order[(index + 1) % order.length];
};

const fetchUserById = async (userId: string): Promise<MessageUser> => {
  await ensureUsersTable();
  const result = await db.query(
    "SELECT id, name, handle FROM users WHERE id = $1 LIMIT 1",
    [userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new Error("User not found");
  }

  return mapUser(result.rows[0] as { id: string; name: string; handle: string });
};

let rankedTablesReady: Promise<void> | null = null;

const ensureRankedTables = async () => {
  if (rankedTablesReady) {
    return rankedTablesReady;
  }

  rankedTablesReady = (async () => {
    try {
      await ensureUsersTable();

      await db.query(`
      CREATE TABLE IF NOT EXISTS ranked_queue (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        enqueued_at timestamptz NOT NULL DEFAULT now()
      );
    `);

      await db.query(`
      CREATE TABLE IF NOT EXISTS ranked_matches (
        id uuid PRIMARY KEY,
        user_a_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_b_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        user_c_id uuid REFERENCES users(id) ON DELETE CASCADE,
        started_at timestamptz NOT NULL DEFAULT now(),
        timed_out boolean NOT NULL DEFAULT false,
        user_a_lives integer NOT NULL DEFAULT ${DEFAULT_LIVES},
        user_b_lives integer NOT NULL DEFAULT ${DEFAULT_LIVES},
        user_c_lives integer NOT NULL DEFAULT ${DEFAULT_LIVES},
        turn_started_at timestamptz NOT NULL DEFAULT now(),
        current_turn_user_id uuid REFERENCES users(id) ON DELETE CASCADE,
        judge_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
        user_a_typing text,
        user_b_typing text,
        user_c_typing text,
        user_a_typing_at timestamptz,
        user_b_typing_at timestamptz,
        user_c_typing_at timestamptz,
        icebreaker_question text,
        character_role_a text,
        character_role_b text,
        character_role_assigned_at_a timestamptz,
        character_role_assigned_at_b timestamptz,
        typing_test_round integer NOT NULL DEFAULT 0,
        typing_test_state text,
        typing_test_started_at timestamptz,
        typing_test_words jsonb,
        typing_test_winner_id uuid REFERENCES users(id) ON DELETE SET NULL,
        typing_test_result_at timestamptz
      );
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS timed_out boolean NOT NULL DEFAULT false;
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS user_a_lives integer NOT NULL DEFAULT ${DEFAULT_LIVES};
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS user_b_lives integer NOT NULL DEFAULT ${DEFAULT_LIVES};
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS user_c_id uuid REFERENCES users(id) ON DELETE CASCADE,
      ADD COLUMN IF NOT EXISTS user_c_lives integer NOT NULL DEFAULT ${DEFAULT_LIVES};
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS turn_started_at timestamptz NOT NULL DEFAULT now();
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS current_turn_user_id uuid REFERENCES users(id) ON DELETE CASCADE;
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS judge_user_id uuid REFERENCES users(id) ON DELETE SET NULL;
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS user_a_typing text,
      ADD COLUMN IF NOT EXISTS user_b_typing text,
      ADD COLUMN IF NOT EXISTS user_c_typing text,
      ADD COLUMN IF NOT EXISTS user_a_typing_at timestamptz,
      ADD COLUMN IF NOT EXISTS user_b_typing_at timestamptz,
      ADD COLUMN IF NOT EXISTS user_c_typing_at timestamptz;
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS icebreaker_question text;
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS character_role_a text,
      ADD COLUMN IF NOT EXISTS character_role_b text,
      ADD COLUMN IF NOT EXISTS character_role_assigned_at_a timestamptz,
      ADD COLUMN IF NOT EXISTS character_role_assigned_at_b timestamptz;
    `);

      await db.query(`
      ALTER TABLE ranked_matches
      ADD COLUMN IF NOT EXISTS typing_test_round integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS typing_test_state text,
      ADD COLUMN IF NOT EXISTS typing_test_started_at timestamptz,
      ADD COLUMN IF NOT EXISTS typing_test_words jsonb,
      ADD COLUMN IF NOT EXISTS typing_test_winner_id uuid REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS typing_test_result_at timestamptz;
    `);

      await db.query(`
      CREATE INDEX IF NOT EXISTS ranked_matches_user_idx
        ON ranked_matches (user_a_id, user_b_id, started_at DESC);
    `);

      await db.query(`
      CREATE INDEX IF NOT EXISTS ranked_matches_user_c_idx
        ON ranked_matches (user_c_id, started_at DESC);
    `);

      await db.query(`
      CREATE TABLE IF NOT EXISTS ranked_messages (
        id uuid PRIMARY KEY,
        match_id uuid NOT NULL REFERENCES ranked_matches(id) ON DELETE CASCADE,
        sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body text NOT NULL,
        edited boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      );
    `);

      await db.query(`
      ALTER TABLE ranked_messages
      ADD COLUMN IF NOT EXISTS edited boolean NOT NULL DEFAULT false;
    `);

      await db.query(`
      CREATE INDEX IF NOT EXISTS ranked_messages_match_idx
        ON ranked_messages (match_id, created_at ASC);
    `);

      await db.query(`
      CREATE TABLE IF NOT EXISTS ranked_transcripts (
        match_id uuid PRIMARY KEY REFERENCES ranked_matches(id) ON DELETE CASCADE,
        transcript jsonb NOT NULL,
        saved_at timestamptz NOT NULL DEFAULT now()
      );
    `);
    } catch (error) {
      rankedTablesReady = null;
      throw error;
    }
  })();

  return rankedTablesReady;
};

const removeFromQueue = async (userId: string) => {
  await db.query("DELETE FROM ranked_queue WHERE user_id = $1", [userId]);
};

const enqueueUser = async (userId: string) => {
  await db.query(
    `INSERT INTO ranked_queue (user_id) VALUES ($1)
     ON CONFLICT (user_id) DO UPDATE SET enqueued_at = now()`,
    [userId]
  );
};

const findWaitingPartners = async (userId: string): Promise<string[]> => {
  const result = await db.query(
    `SELECT user_id
     FROM ranked_queue
     WHERE user_id <> $1
     ORDER BY enqueued_at ASC
     LIMIT 2`,
    [userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return [];
  }

  return (result.rows as Array<{ user_id: string }>).map((row) => row.user_id);
};

const createMatch = async (userIds: string[]) => {
  const matchId = randomUUID();
  const shuffled = [...userIds].sort(() => Math.random() - 0.5);
  const [userA, userB, userC] = shuffled;
  if (!userA || !userB || !userC) {
    throw new Error("Three users are required to start a match");
  }
  const startingTurnUserId = Math.random() < 0.5 ? userA : userB;
  const icebreakerQuestion = pickIcebreakerQuestion();
  const characterRoleA = pickCharacterRole();
  const characterRoleB = pickCharacterRole();
  await db.query(
    `INSERT INTO ranked_matches (
      id,
      user_a_id,
      user_b_id,
      user_c_id,
      user_a_lives,
      user_b_lives,
      user_c_lives,
      turn_started_at,
      current_turn_user_id,
      judge_user_id,
      icebreaker_question,
      character_role_a,
      character_role_b,
      character_role_assigned_at_a,
      character_role_assigned_at_b
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, now(), $8, $9, $10, $11, $12, now(), now())`,
    [
      matchId,
      userA,
      userB,
      userC,
      DEFAULT_LIVES,
      DEFAULT_LIVES,
      DEFAULT_LIVES,
      startingTurnUserId,
      icebreakerQuestion,
      characterRoleA,
      characterRoleB,
    ]
  );
  return {
    matchId,
    userA,
    userB,
    userC,
    startingTurnUserId,
    icebreakerQuestion,
    characterRoleA,
    characterRoleB,
    judgeUserId: userC,
  };
};

const getMatch = async (matchId: string): Promise<RankedMatchRow | null> => {
  const result = await db.query(
    `SELECT ${rankedMatchColumns}
     FROM ranked_matches WHERE id = $1 LIMIT 1`,
    [matchId]
  );
  if ((result.rowCount ?? 0) === 0) {
    return null;
  }
  const row = result.rows[0] as RankedMatchRow;
  if (!row.current_turn_user_id) {
    await db.query(
      `UPDATE ranked_matches
       SET current_turn_user_id = $2
       WHERE id = $1`,
      [matchId, row.user_a_id]
    );
    row.current_turn_user_id = row.user_a_id;
  }
  return row;
};

const parseTimestamp = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const normalizeTypingAttempt = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const typingWordPool: { value: string[] | null } = { value: null };

const getTypingWordPool = () => {
  if (typingWordPool.value) {
    return typingWordPool.value;
  }
  const pool: string[] = [];
  for (let length = TYPING_TEST_MIN_WORD_LENGTH; length <= TYPING_TEST_MAX_WORD_LENGTH; length += 1) {
    pool.push(...getWordsByLength(length));
  }
  typingWordPool.value = pool;
  return pool;
};

const getTypingTestWords = () => {
  const pool = getTypingWordPool();
  if (pool.length === 0) {
    return [] as string[];
  }
  const unique = new Set<string>();
  const limit = Math.min(TYPING_TEST_WORD_COUNT, pool.length);
  let attempts = 0;
  while (unique.size < limit && attempts < pool.length * 2) {
    const choice = pool[Math.floor(Math.random() * pool.length)];
    if (choice) {
      unique.add(choice);
    }
    attempts += 1;
  }
  return Array.from(unique).slice(0, limit);
};

const parseTypingWords = (value: unknown): string[] => {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.filter((entry) => typeof entry === "string");
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((entry) => typeof entry === "string")
        : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getTypingTestPayload = (match: RankedMatchRow): TypingTestPayload => {
  const round = match.typing_test_round ?? 0;
  if (!match.typing_test_state) {
    return { state: "idle", words: [], round };
  }
  const startedAt = match.typing_test_started_at
    ? parseTimestamp(match.typing_test_started_at).toISOString()
    : undefined;
  const resultAt = match.typing_test_result_at
    ? parseTimestamp(match.typing_test_result_at).toISOString()
    : undefined;
  return {
    state: match.typing_test_state as TypingTestState,
    words: parseTypingWords(match.typing_test_words),
    startedAt,
    resultAt,
    winnerId: match.typing_test_winner_id ?? null,
    round,
  };
};

const isTypingTestBlocking = (match: RankedMatchRow) =>
  !!match.typing_test_state;

const maybeAdvanceTypingTestState = async (
  match: RankedMatchRow
): Promise<RankedMatchRow> => {
  if (!match.typing_test_state) {
    return match;
  }
  if (
    match.typing_test_state === "countdown" &&
    match.typing_test_started_at
  ) {
    const startedAt = parseTimestamp(match.typing_test_started_at);
    if (Date.now() - startedAt.getTime() >= TYPING_TEST_COUNTDOWN_SECONDS * 1000) {
      const updated = await db.query(
        `UPDATE ranked_matches
         SET typing_test_state = 'active'
         WHERE id = $1 AND typing_test_state = 'countdown'
         RETURNING ${rankedMatchColumns}`,
        [match.id]
      );
      if ((updated.rowCount ?? 0) > 0) {
        return updated.rows[0] as RankedMatchRow;
      }
    }
  }
  if (
    match.typing_test_state === "result" &&
    match.typing_test_result_at
  ) {
    const resultAt = parseTimestamp(match.typing_test_result_at);
    if (Date.now() - resultAt.getTime() >= TYPING_TEST_RESULT_SECONDS * 1000) {
      const updated = await db.query(
        `UPDATE ranked_matches
         SET typing_test_state = NULL,
             typing_test_started_at = NULL,
             typing_test_words = NULL,
             typing_test_winner_id = NULL,
             typing_test_result_at = NULL,
             turn_started_at = now()
         WHERE id = $1 AND typing_test_state = 'result'
         RETURNING ${rankedMatchColumns}`,
        [match.id]
      );
      if ((updated.rowCount ?? 0) > 0) {
        return updated.rows[0] as RankedMatchRow;
      }
    }
  }
  return match;
};

const getTurnState = (match: { turn_started_at: string | Date }) => {
  const startedAt = parseTimestamp(match.turn_started_at);
  const elapsedMs = Date.now() - startedAt.getTime();
  const expired = elapsedMs >= TURN_SECONDS * 1000;
  return { startedAt, expired };
};

const awardDailyWin = async (winnerId: string) => {
  await ensureUsersTable();
  const result = await db.query(
    `UPDATE users
     SET coins = COALESCE(coins, 0) + $2,
         last_ranked_win_reward_at = now()
     WHERE id = $1
       AND (
         last_ranked_win_reward_at IS NULL
         OR last_ranked_win_reward_at::date < now()::date
       )
     RETURNING coins`,
    [winnerId, WIN_REWARD_COINS]
  );
  return (result.rowCount ?? 0) > 0;
};

const applyTurnTimeout = async (
  match: RankedMatchRow
): Promise<RankedMatchRow | null> => {
  if (!match.current_turn_user_id) {
    return null;
  }
  const result = await db.query(
    `UPDATE ranked_matches
     SET user_a_lives = CASE
           WHEN current_turn_user_id = user_a_id
             THEN GREATEST(user_a_lives - 1, 0)
           ELSE user_a_lives
         END,
         user_b_lives = CASE
           WHEN current_turn_user_id = user_b_id
             THEN GREATEST(user_b_lives - 1, 0)
           ELSE user_b_lives
         END,
         turn_started_at = now(),
         current_turn_user_id = CASE
           WHEN current_turn_user_id = user_a_id THEN user_b_id
           WHEN current_turn_user_id = user_b_id THEN user_a_id
           ELSE current_turn_user_id
         END,
         timed_out = CASE
           WHEN (CASE
             WHEN current_turn_user_id = user_a_id THEN GREATEST(user_a_lives - 1, 0)
             ELSE user_a_lives
           END) <= 0
           OR (CASE
             WHEN current_turn_user_id = user_b_id THEN GREATEST(user_b_lives - 1, 0)
             ELSE user_b_lives
           END) <= 0
           THEN true
           ELSE false
         END
     WHERE id = $1
       AND timed_out = false
       AND current_turn_user_id = $2
       AND turn_started_at <= now() - interval '${TURN_SECONDS} seconds'
     RETURNING ${rankedMatchColumns}`,
    [match.id, match.current_turn_user_id]
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  const updated = result.rows[0] as RankedMatchRow;

  if (updated.timed_out) {
    const winnerId =
      updated.user_a_lives <= 0
        ? updated.user_b_id
        : updated.user_b_lives <= 0
          ? updated.user_a_id
          : null;
    if (winnerId) {
      await awardDailyWin(winnerId);
    }
  }

  return updated;
};

const ensureMatchTimer = async (match: RankedMatchRow) => {
  const updatedMatch = await maybeAdvanceTypingTestState(match);
  if (isTypingTestBlocking(updatedMatch)) {
    return {
      startedAt: parseTimestamp(updatedMatch.turn_started_at),
      timedOut: updatedMatch.timed_out,
      match: updatedMatch,
    };
  }
  const { startedAt, expired } = getTurnState(updatedMatch);
  if (!expired || updatedMatch.timed_out) {
    return { startedAt, timedOut: updatedMatch.timed_out, match: updatedMatch };
  }

  const updated = await applyTurnTimeout(updatedMatch);
  if (updated) {
    return {
      startedAt: parseTimestamp(updated.turn_started_at),
      timedOut: updated.timed_out,
      match: updated,
    };
  }

  const refreshed = await getMatch(match.id);
  if (!refreshed) {
    return { startedAt, timedOut: true, match };
  }

  return {
    startedAt: parseTimestamp(refreshed.turn_started_at),
    timedOut: refreshed.timed_out,
    match: refreshed,
  };
};

const maybeStartTypingTest = async (
  matchId: string,
  match: RankedMatchRow
): Promise<RankedMatchRow> => {
  if (match.timed_out || match.typing_test_state) {
    return match;
  }
  const round = match.typing_test_round ?? 0;
  const triggerAt = (round + 1) * TYPING_TEST_TRIGGER_MESSAGES;
  const countResult = await db.query(
    "SELECT COUNT(*)::int AS count FROM ranked_messages WHERE match_id = $1",
    [matchId]
  );
  const count = Number((countResult.rows[0] as { count: number }).count);
  if (count < triggerAt) {
    return match;
  }
  const words = getTypingTestWords();
  if (words.length === 0) {
    return match;
  }
  const updated = await db.query(
    `UPDATE ranked_matches
     SET typing_test_state = 'countdown',
         typing_test_started_at = now(),
         typing_test_words = $2::jsonb,
         typing_test_winner_id = NULL,
         typing_test_result_at = NULL,
         typing_test_round = COALESCE(typing_test_round, 0) + 1
     WHERE id = $1 AND typing_test_state IS NULL
     RETURNING ${rankedMatchColumns}`,
    [matchId, JSON.stringify(words)]
  );
  if ((updated.rowCount ?? 0) > 0) {
    return updated.rows[0] as RankedMatchRow;
  }
  return match;
};

const assertParticipant = async (matchId: string, userId: string) => {
  const match = await getMatch(matchId);
  if (!match) {
    throw new Error("Match not found");
  }
  const isParticipant =
    match.user_a_id === userId ||
    match.user_b_id === userId ||
    match.user_c_id === userId;
  if (!isParticipant) {
    throw new Error("You are not part of this match");
  }
  return match;
};

export const enqueueAndMatch = async (userId: string): Promise<RankedStatus> => {
  await ensureRankedTables();

  // End any prior active match so a fresh session is created every time.
  await db.query(
    `UPDATE ranked_matches
     SET timed_out = true
     WHERE timed_out = false
       AND (user_a_id = $1 OR user_b_id = $1 OR user_c_id = $1)`,
    [userId]
  );

  // Remove stale queue entry for the same user to avoid duplicates.
  await removeFromQueue(userId);

  const partners = await findWaitingPartners(userId);

  if (partners.length >= 2) {
    // Pair with the oldest waiting partners.
    await Promise.all(partners.map((id) => removeFromQueue(id)));
    const { matchId, startingTurnUserId, icebreakerQuestion, characterRoleA, characterRoleB, userA, userB, userC, judgeUserId } =
      await createMatch([userId, ...partners]);
    const opponentIds = [userA, userB, userC].filter((id) => id !== userId);
    const opponents = await Promise.all(opponentIds.map((id) => fetchUserById(id)));
    const nowIso = new Date().toISOString();
    const isJudge = judgeUserId === userId;
    const characterRole =
      userId === userA ? characterRoleA ?? null : userId === userB ? characterRoleB ?? null : null;
    return {
      status: "matched",
      matchId,
      opponents,
      startedAt: nowIso,
      lives: { me: DEFAULT_LIVES, opponents: [DEFAULT_LIVES, DEFAULT_LIVES] },
      turnStartedAt: nowIso,
      serverTime: nowIso,
      isMyTurn: !isJudge && startingTurnUserId === userId,
      currentTurnUserId: startingTurnUserId,
      isJudge,
      judgeUserId,
      icebreakerQuestion,
      characterRole,
      characterRoleAssignedAt: characterRole ? nowIso : null,
    };
  }

  await enqueueUser(userId);
  return { status: "waiting" };
};

export const getRankedStatusForUser = async (userId: string): Promise<RankedStatus> => {
  await ensureRankedTables();

  const matchResult = await db.query(
    `SELECT ${rankedMatchColumns}
     FROM ranked_matches
     WHERE (user_a_id = $1 OR user_b_id = $1 OR user_c_id = $1) AND timed_out = false
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId]
  );

  if ((matchResult.rowCount ?? 0) > 0) {
    const row = matchResult.rows[0] as RankedMatchRow;
    if (!row.current_turn_user_id) {
      await db.query(
        `UPDATE ranked_matches
         SET current_turn_user_id = $2
         WHERE id = $1`,
        [row.id, row.user_a_id]
      );
      row.current_turn_user_id = row.user_a_id;
    }
    const timerState = await ensureMatchTimer(row);
    if (timerState.timedOut) {
      return { status: "idle" };
    }
    const withIcebreaker = await ensureIcebreakerQuestion(timerState.match);
    const activeMatch = await ensureCharacterRole(withIcebreaker);
    const { opponents, opponentLives } = await getOpponentsForUser(activeMatch, userId);
    const meLives = getLivesForUser(activeMatch, userId);
    const isJudge = activeMatch.judge_user_id === userId;
    const { role: characterRole, assignedAt: characterRoleAssignedAt } =
      getCharacterRoleForUser(activeMatch, userId);
    const nowIso = new Date().toISOString();
    return {
      status: "matched",
      matchId: activeMatch.id,
      opponents,
      startedAt:
        activeMatch.started_at instanceof Date
          ? activeMatch.started_at.toISOString()
          : new Date(activeMatch.started_at).toISOString(),
      lives: { me: meLives, opponents: opponentLives },
      turnStartedAt: timerState.startedAt.toISOString(),
      serverTime: nowIso,
      isMyTurn: !isJudge && activeMatch.current_turn_user_id === userId,
      currentTurnUserId: activeMatch.current_turn_user_id,
      isJudge,
      judgeUserId: activeMatch.judge_user_id ?? null,
      icebreakerQuestion: activeMatch.icebreaker_question ?? null,
      characterRole,
      characterRoleAssignedAt,
    };
  }

  const queueResult = await db.query(
    `SELECT 1 FROM ranked_queue WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  if ((queueResult.rowCount ?? 0) > 0) {
    return { status: "waiting" };
  }

  return { status: "idle" };
};

export const cancelRankedQueue = async (userId: string) => {
  await ensureRankedTables();
  await removeFromQueue(userId);
};

export const fetchRankedMessages = async (
  matchId: string,
  userId: string
): Promise<{
  messages: RankedMessage[];
  timedOut: boolean;
  turnStartedAt: string;
  serverTime: string;
  isMyTurn: boolean;
  currentTurnUserId: string | null;
  isJudge: boolean;
  judgeUserId: string | null;
  lives: { me: number; opponents: number[] };
  typing: string;
  typingTest: TypingTestPayload;
  icebreakerQuestion: string | null;
  characterRole: string | null;
  characterRoleAssignedAt: string | null;
}> => {
  await ensureRankedTables();
  const match = await assertParticipant(matchId, userId);
  const timerState = await ensureMatchTimer(match);
  const withIcebreaker = await ensureIcebreakerQuestion(timerState.match);
  const withRole = await ensureCharacterRole(withIcebreaker);
  const activeMatch = await maybeStartTypingTest(matchId, withRole);

  const result = await db.query(
    `SELECT m.id,
            m.body,
            m.created_at,
            sender.id AS sender_id,
            sender.name AS sender_name,
            sender.handle AS sender_handle
     FROM ranked_messages m
     JOIN users sender ON sender.id = m.sender_id
     JOIN ranked_matches rm ON rm.id = m.match_id
     WHERE m.match_id = $1
       AND m.created_at >= rm.started_at
     ORDER BY m.created_at ASC`,
    [matchId]
  );

  const messages = (result.rows as Array<{
    id: string;
    body: string;
    created_at: string | Date;
    sender_id: string;
    sender_name: string;
    sender_handle: string;
    edited: boolean;
  }>).map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at instanceof Date
      ? row.created_at.toISOString()
      : new Date(row.created_at).toISOString(),
    sender: {
      id: row.sender_id,
      name: row.sender_name,
      handle: row.sender_handle,
    },
    edited: row.edited,
  }));

  const opponentIds = getOpponentIds(activeMatch, userId);
  const opponentLives = opponentIds.map((id) => getLivesForUser(activeMatch, id));
  const meLives = getLivesForUser(activeMatch, userId);
  const activeOpponentId = getActiveOpponentId(activeMatch, userId);
  const { text: typingText, at: typingAtRaw } = getTypingForUserId(
    activeMatch,
    activeOpponentId
  );
  const typingAt = typingAtRaw ? parseTimestamp(typingAtRaw) : null;
  const isTypingFresh = typingAt
    ? Date.now() - typingAt.getTime() <= 6000
    : false;
  const typing = isTypingFresh && typingText ? typingText : "";
  const { role: characterRole, assignedAt: characterRoleAssignedAt } =
    getCharacterRoleForUser(activeMatch, userId);
  const isJudge = activeMatch.judge_user_id === userId;

  return {
    messages,
    timedOut: timerState.timedOut,
    turnStartedAt: timerState.startedAt.toISOString(),
    serverTime: new Date().toISOString(),
    isMyTurn: !isJudge && activeMatch.current_turn_user_id === userId,
    currentTurnUserId: activeMatch.current_turn_user_id,
    isJudge,
    judgeUserId: activeMatch.judge_user_id ?? null,
    lives: { me: meLives, opponents: opponentLives },
    typing,
    typingTest: getTypingTestPayload(activeMatch),
    icebreakerQuestion: activeMatch.icebreaker_question ?? null,
    characterRole,
    characterRoleAssignedAt,
  };
};

export const updateRankedTyping = async (params: {
  matchId: string;
  userId: string;
  body: string;
}) => {
  await ensureRankedTables();
  const match = await assertParticipant(params.matchId, params.userId);
  if (match.judge_user_id === params.userId) {
    return;
  }
  const raw = typeof params.body === "string" ? params.body : "";
  const body = raw.slice(0, 500);
  let typingColumn = "user_a_typing";
  let typingAtColumn = "user_a_typing_at";
  if (match.user_b_id === params.userId) {
    typingColumn = "user_b_typing";
    typingAtColumn = "user_b_typing_at";
  } else if (match.user_c_id === params.userId) {
    typingColumn = "user_c_typing";
    typingAtColumn = "user_c_typing_at";
  }
  if (!body.trim()) {
    await db.query(
      `UPDATE ranked_matches
       SET ${typingColumn} = NULL,
           ${typingAtColumn} = NULL
       WHERE id = $1`,
      [params.matchId]
    );
    return;
  }
  await db.query(
    `UPDATE ranked_matches
     SET ${typingColumn} = $2,
         ${typingAtColumn} = now()
     WHERE id = $1`,
    [params.matchId, body]
  );
};

export const submitTypingTestAttempt = async (params: {
  matchId: string;
  userId: string;
  attempt: string;
}) => {
  await ensureRankedTables();
  const match = await assertParticipant(params.matchId, params.userId);
  if (match.judge_user_id === params.userId) {
    throw new Error("Judges cannot submit typing test attempts");
  }
  const activeMatch = await maybeAdvanceTypingTestState(match);
  if (!activeMatch.typing_test_state) {
    throw new Error("Typing test is not active");
  }
  if (activeMatch.typing_test_state === "countdown") {
    throw new Error("Typing test has not started yet");
  }
  if (activeMatch.typing_test_state === "result") {
    return { winnerId: activeMatch.typing_test_winner_id ?? null };
  }

  const words = parseTypingWords(activeMatch.typing_test_words);
  const expected = normalizeTypingAttempt(words.join(" "));
  const attempt = normalizeTypingAttempt(params.attempt ?? "");
  if (!attempt) {
    throw new Error("Typing attempt is required");
  }
  if (!expected || attempt !== expected) {
    return { winnerId: activeMatch.typing_test_winner_id ?? null };
  }

  const loserId =
    activeMatch.user_a_id === params.userId
      ? activeMatch.user_b_id
      : activeMatch.user_a_id;

  const updated = await db.query(
    `UPDATE ranked_matches
     SET typing_test_state = 'result',
         typing_test_winner_id = $2,
         typing_test_result_at = now(),
         user_a_lives = CASE
           WHEN user_a_id = $3 THEN GREATEST(user_a_lives - 1, 0)
           ELSE user_a_lives
         END,
         user_b_lives = CASE
           WHEN user_b_id = $3 THEN GREATEST(user_b_lives - 1, 0)
           ELSE user_b_lives
         END,
         timed_out = CASE
           WHEN (CASE
             WHEN user_a_id = $3 THEN GREATEST(user_a_lives - 1, 0)
             ELSE user_a_lives
           END) <= 0
           OR (CASE
             WHEN user_b_id = $3 THEN GREATEST(user_b_lives - 1, 0)
             ELSE user_b_lives
           END) <= 0
           THEN true
           ELSE timed_out
         END
     WHERE id = $1
       AND typing_test_state = 'active'
       AND typing_test_winner_id IS NULL
     RETURNING ${rankedMatchColumns}`,
    [params.matchId, params.userId, loserId]
  );

  if ((updated.rowCount ?? 0) > 0) {
    const row = updated.rows[0] as RankedMatchRow;
    if (row.timed_out) {
      await awardDailyWin(params.userId);
    }
    return { winnerId: row.typing_test_winner_id ?? params.userId };
  }

  const refreshed = await getMatch(params.matchId);
  return { winnerId: refreshed?.typing_test_winner_id ?? null };
};

export const sendRankedMessage = async (params: {
  matchId: string;
  senderId: string;
  body: string;
}): Promise<RankedMessage> => {
  await ensureRankedTables();
  const match = await assertParticipant(params.matchId, params.senderId);
  const timerState = await ensureMatchTimer(match);
  if (timerState.timedOut) {
    throw new Error("Match has ended");
  }
  const activeMatch = timerState.match;
  if (activeMatch.typing_test_state) {
    throw new Error("Typing test in progress");
  }
  if (activeMatch.judge_user_id === params.senderId) {
    throw new Error("Judges cannot send messages");
  }
  if (
    activeMatch.current_turn_user_id &&
    activeMatch.current_turn_user_id !== params.senderId
  ) {
    throw new Error("Not your turn");
  }

  const trimmed = params.body.trim();
  if (!trimmed) {
    throw new Error("Message body is required");
  }
  if (trimmed.length > 2000) {
    throw new Error("Message is too long");
  }

  const id = randomUUID();

  const result = await db.query(
    `INSERT INTO ranked_messages (id, match_id, sender_id, body, edited)
     VALUES ($1, $2, $3, $4, false)
     RETURNING id, match_id, sender_id, body, created_at, edited`,
    [id, params.matchId, params.senderId, trimmed]
  );

  const nextTurnUserId = getNextTurnUserId(activeMatch, params.senderId);
  await db.query(
    `UPDATE ranked_matches
     SET turn_started_at = now(),
         current_turn_user_id = $2
     WHERE id = $1`,
    [params.matchId, nextTurnUserId]
  );

  await maybeStartTypingTest(params.matchId, activeMatch);

  const row = result.rows[0] as {
    id: string;
    match_id: string;
    sender_id: string;
    body: string;
    created_at: string | Date;
    edited: boolean;
  };

  const sender = await fetchUserById(params.senderId);

  return {
    id: row.id,
    body: row.body,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : new Date(row.created_at).toISOString(),
    sender,
    edited: row.edited,
  };
};

export const smiteRankedOpponent = async (params: {
  matchId: string;
  userId: string;
}) => {
  await ensureRankedTables();
  const match = await assertParticipant(params.matchId, params.userId);
  if (match.timed_out) {
    throw new Error("Match has ended");
  }
  const partnerId = getActiveOpponentId(match, params.userId);
  if (!partnerId) {
    throw new Error("No opponent to smite");
  }

  const updated = await db.query(
    `UPDATE ranked_matches
     SET user_a_lives = CASE
           WHEN user_a_id = $2 THEN GREATEST(user_a_lives - 3, 0)
           ELSE user_a_lives
         END,
         user_b_lives = CASE
           WHEN user_b_id = $2 THEN GREATEST(user_b_lives - 3, 0)
           ELSE user_b_lives
         END,
         timed_out = CASE
           WHEN (CASE
             WHEN user_a_id = $2 THEN GREATEST(user_a_lives - 3, 0)
             ELSE user_a_lives
           END) <= 0
           OR (CASE
             WHEN user_b_id = $2 THEN GREATEST(user_b_lives - 3, 0)
             ELSE user_b_lives
           END) <= 0
           THEN true
           ELSE timed_out
         END,
         typing_test_state = NULL,
         typing_test_started_at = NULL,
         typing_test_words = NULL,
         typing_test_winner_id = NULL,
         typing_test_result_at = NULL
     WHERE id = $1
     RETURNING ${rankedMatchColumns}`,
    [params.matchId, partnerId]
  );

  if ((updated.rowCount ?? 0) === 0) {
    throw new Error("Match not found");
  }

  const row = updated.rows[0] as RankedMatchRow;
  if (row.timed_out) {
    await awardDailyWin(params.userId);
  }
  return row;
};

export const updateRankedMessage = async (params: {
  matchId: string;
  messageId: string;
  userId: string;
  body: string;
}): Promise<RankedMessage> => {
  await ensureRankedTables();
  await assertParticipant(params.matchId, params.userId);
  const trimmed = params.body.trim();
  if (!trimmed) {
    throw new Error("Message body is required");
  }
  if (trimmed.length > 2000) {
    throw new Error("Message is too long");
  }

  const existing = await db.query(
    `SELECT id, sender_id FROM ranked_messages WHERE id = $1 AND match_id = $2`,
    [params.messageId, params.matchId]
  );
  if ((existing.rowCount ?? 0) === 0) {
    throw new Error("Message not found");
  }
  const row = existing.rows[0] as { id: string; sender_id: string };
  if (row.sender_id !== params.userId) {
    throw new Error("You can only edit your own messages");
  }

  await db.query(
    `UPDATE ranked_messages SET body = $1, edited = true WHERE id = $2`,
    [trimmed, params.messageId]
  );

  const updated = await db.query(
    `SELECT m.id,
            m.body,
            m.edited,
            m.created_at,
            sender.id AS sender_id,
            sender.name AS sender_name,
            sender.handle AS sender_handle
     FROM ranked_messages m
     JOIN users sender ON sender.id = m.sender_id
     WHERE m.id = $1`,
    [params.messageId]
  );

  const u = updated.rows[0] as {
    id: string;
    body: string;
    edited: boolean;
    created_at: string | Date;
    sender_id: string;
    sender_name: string;
    sender_handle: string;
  };

  return {
    id: u.id,
    body: u.body,
    createdAt:
      u.created_at instanceof Date
        ? u.created_at.toISOString()
        : new Date(u.created_at).toISOString(),
    sender: {
      id: u.sender_id,
      name: u.sender_name,
      handle: u.sender_handle,
    },
    edited: u.edited,
  };
};

export const deleteRankedMessageById = async (params: {
  matchId: string;
  messageId: string;
  userId: string;
}) => {
  await ensureRankedTables();
  await assertParticipant(params.matchId, params.userId);
  const result = await db.query(
    `DELETE FROM ranked_messages WHERE id = $1 AND sender_id = $2`,
    [params.messageId, params.userId]
  );
  if ((result.rowCount ?? 0) === 0) {
    throw new Error("Message not found or not yours");
  }
};

export const saveRankedTranscript = async (matchId: string, userId: string) => {
  await ensureRankedTables();
  await assertParticipant(matchId, userId);

  const existing = await db.query(
    "SELECT saved_at FROM ranked_transcripts WHERE match_id = $1 LIMIT 1",
    [matchId]
  );
  if ((existing.rowCount ?? 0) > 0) {
    return { savedAt: (existing.rows[0] as { saved_at: string | Date }).saved_at };
  }

  const { messages } = await fetchRankedMessages(matchId, userId);

  const transcript = messages.map((message) => ({
    id: message.id,
    body: message.body,
    createdAt: message.createdAt,
    sender: message.sender,
  }));

  const result = await db.query(
    `INSERT INTO ranked_transcripts (match_id, transcript)
     VALUES ($1, $2)
     RETURNING saved_at`,
    [matchId, JSON.stringify(transcript)]
  );

  return { savedAt: (result.rows[0] as { saved_at: string | Date }).saved_at };
};

export const markRankedTimeout = async (matchId: string, userId: string) => {
  await ensureRankedTables();
  const match = await assertParticipant(matchId, userId);
  await ensureMatchTimer(match);
};
