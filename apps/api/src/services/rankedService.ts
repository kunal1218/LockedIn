import { randomUUID } from "crypto";
import { db } from "../db";
import { ensureUsersTable } from "./authService";
import type { MessageUser } from "./messageService";

export type RankedStatus =
  | {
      status: "matched";
      matchId: string;
      partner: MessageUser;
      startedAt: string;
      lives: { me: number; partner: number };
      turnStartedAt: string;
      serverTime: string;
      isMyTurn: boolean;
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

const DEFAULT_LIVES = 3;
const TURN_SECONDS = 15;

const mapUser = (row: { id: string; name: string; handle: string }): MessageUser => ({
  id: row.id,
  name: row.name,
  handle: row.handle,
});

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

const ensureRankedTables = async () => {
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
      started_at timestamptz NOT NULL DEFAULT now(),
      timed_out boolean NOT NULL DEFAULT false,
      user_a_lives integer NOT NULL DEFAULT ${DEFAULT_LIVES},
      user_b_lives integer NOT NULL DEFAULT ${DEFAULT_LIVES},
      turn_started_at timestamptz NOT NULL DEFAULT now(),
      current_turn_user_id uuid REFERENCES users(id) ON DELETE CASCADE
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
    ADD COLUMN IF NOT EXISTS turn_started_at timestamptz NOT NULL DEFAULT now();
  `);

  await db.query(`
    ALTER TABLE ranked_matches
    ADD COLUMN IF NOT EXISTS current_turn_user_id uuid REFERENCES users(id) ON DELETE CASCADE;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS ranked_matches_user_idx
      ON ranked_matches (user_a_id, user_b_id, started_at DESC);
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

const findWaitingPartner = async (userId: string): Promise<string | null> => {
  const result = await db.query(
    `SELECT user_id
     FROM ranked_queue
     WHERE user_id <> $1
     ORDER BY enqueued_at ASC
     LIMIT 1`,
    [userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  return (result.rows[0] as { user_id: string }).user_id;
};

const createMatch = async (userId: string, partnerId: string) => {
  const matchId = randomUUID();
  const startingTurnUserId = Math.random() < 0.5 ? userId : partnerId;
  await db.query(
    `INSERT INTO ranked_matches (
      id,
      user_a_id,
      user_b_id,
      user_a_lives,
      user_b_lives,
      turn_started_at,
      current_turn_user_id
    )
     VALUES ($1, $2, $3, $4, $5, now(), $6)`,
    [matchId, userId, partnerId, DEFAULT_LIVES, DEFAULT_LIVES, startingTurnUserId]
  );
  return { matchId, startingTurnUserId };
};

const getMatch = async (matchId: string) => {
  const result = await db.query(
    `SELECT id, user_a_id, user_b_id, started_at, timed_out, user_a_lives, user_b_lives, turn_started_at, current_turn_user_id
     FROM ranked_matches WHERE id = $1 LIMIT 1`,
    [matchId]
  );
  if ((result.rowCount ?? 0) === 0) {
    return null;
  }
  const row = result.rows[0] as {
    id: string;
    user_a_id: string;
    user_b_id: string;
    started_at: string | Date;
    timed_out: boolean;
    user_a_lives: number;
    user_b_lives: number;
    turn_started_at: string | Date;
    current_turn_user_id: string | null;
  };
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

const getTurnState = (match: {
  id: string;
  timed_out: boolean;
  turn_started_at: string | Date;
}) => {
  const startedAt = parseTimestamp(match.turn_started_at);
  const elapsedMs = Date.now() - startedAt.getTime();
  const expired = elapsedMs >= TURN_SECONDS * 1000;
  return { startedAt, expired };
};

const ensureMatchTimer = async (match: {
  id: string;
  timed_out: boolean;
  turn_started_at: string | Date;
}) => {
  const { startedAt, expired } = getTurnState(match);
  const timedOut = match.timed_out || expired;
  if (expired && !match.timed_out) {
    await db.query(
      `UPDATE ranked_matches
       SET timed_out = true
       WHERE id = $1`,
      [match.id]
    );
  }
  return { startedAt, timedOut };
};

const assertParticipant = async (matchId: string, userId: string) => {
  const match = await getMatch(matchId);
  if (!match) {
    throw new Error("Match not found");
  }
  const isParticipant = match.user_a_id === userId || match.user_b_id === userId;
  if (!isParticipant) {
    throw new Error("You are not part of this match");
  }
  const partnerId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;
  return { match, partnerId };
};

export const enqueueAndMatch = async (userId: string): Promise<RankedStatus> => {
  await ensureRankedTables();

  // End any prior active match so a fresh session is created every time.
  await db.query(
    `UPDATE ranked_matches
     SET timed_out = true
     WHERE timed_out = false AND (user_a_id = $1 OR user_b_id = $1)`,
    [userId]
  );

  // Remove stale queue entry for the same user to avoid duplicates.
  await removeFromQueue(userId);

  const partnerId = await findWaitingPartner(userId);

  if (partnerId) {
    // Pair with the oldest waiting partner.
    await removeFromQueue(partnerId);
    const { matchId, startingTurnUserId } = await createMatch(userId, partnerId);
    const partner = await fetchUserById(partnerId);
    const nowIso = new Date().toISOString();
    return {
      status: "matched",
      matchId,
      partner,
      startedAt: nowIso,
      lives: { me: DEFAULT_LIVES, partner: DEFAULT_LIVES },
      turnStartedAt: nowIso,
      serverTime: nowIso,
      isMyTurn: startingTurnUserId === userId,
    };
  }

  await enqueueUser(userId);
  return { status: "waiting" };
};

export const getRankedStatusForUser = async (userId: string): Promise<RankedStatus> => {
  await ensureRankedTables();

  const matchResult = await db.query(
    `SELECT id, user_a_id, user_b_id, started_at, user_a_lives, user_b_lives, turn_started_at, timed_out, current_turn_user_id
     FROM ranked_matches
     WHERE (user_a_id = $1 OR user_b_id = $1) AND timed_out = false
     ORDER BY started_at DESC
     LIMIT 1`,
    [userId]
  );

  if ((matchResult.rowCount ?? 0) > 0) {
    const row = matchResult.rows[0] as {
      id: string;
      user_a_id: string;
      user_b_id: string;
      started_at: string | Date;
      user_a_lives: number;
      user_b_lives: number;
      turn_started_at: string | Date;
      timed_out: boolean;
      current_turn_user_id: string | null;
    };
    const timerState = await ensureMatchTimer({
      id: row.id,
      timed_out: row.timed_out,
      turn_started_at: row.turn_started_at,
    });
    if (timerState.timedOut) {
      return { status: "idle" };
    }
    const partnerId = row.user_a_id === userId ? row.user_b_id : row.user_a_id;
    const partner = await fetchUserById(partnerId);
    const meLives = row.user_a_id === userId ? row.user_a_lives : row.user_b_lives;
    const partnerLives =
      row.user_a_id === userId ? row.user_b_lives : row.user_a_lives;
    if (!row.current_turn_user_id) {
      await db.query(
        `UPDATE ranked_matches
         SET current_turn_user_id = $2
         WHERE id = $1`,
        [row.id, row.user_a_id]
      );
      row.current_turn_user_id = row.user_a_id;
    }
    const nowIso = new Date().toISOString();
    const isMyTurn = row.current_turn_user_id === userId;
    return {
      status: "matched",
      matchId: row.id,
      partner,
      startedAt:
        row.started_at instanceof Date
          ? row.started_at.toISOString()
          : new Date(row.started_at).toISOString(),
      lives: { me: meLives, partner: partnerLives },
      turnStartedAt: timerState.startedAt.toISOString(),
      serverTime: nowIso,
      isMyTurn,
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
}> => {
  await ensureRankedTables();
  const { match } = await assertParticipant(matchId, userId);
  const timerState = await ensureMatchTimer({
    id: match.id,
    timed_out: match.timed_out,
    turn_started_at: match.turn_started_at,
  });
  const isMyTurn = match.current_turn_user_id === userId;

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

  return {
    messages,
    timedOut: timerState.timedOut,
    turnStartedAt: timerState.startedAt.toISOString(),
    serverTime: new Date().toISOString(),
    isMyTurn,
  };
};

export const sendRankedMessage = async (params: {
  matchId: string;
  senderId: string;
  body: string;
}): Promise<RankedMessage> => {
  await ensureRankedTables();
  const { match } = await assertParticipant(params.matchId, params.senderId);
  if (match.current_turn_user_id && match.current_turn_user_id !== params.senderId) {
    throw new Error("Not your turn");
  }
  const timerState = await ensureMatchTimer({
    id: match.id,
    timed_out: match.timed_out,
    turn_started_at: match.turn_started_at,
  });
  if (timerState.timedOut) {
    throw new Error("Match has ended");
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

  const nextTurnUserId =
    match.user_a_id === params.senderId ? match.user_b_id : match.user_a_id;
  await db.query(
    `UPDATE ranked_matches
     SET turn_started_at = now(),
         current_turn_user_id = $2
     WHERE id = $1`,
    [params.matchId, nextTurnUserId]
  );

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
  await assertParticipant(matchId, userId);
  await db.query(
    `UPDATE ranked_matches
     SET timed_out = true
     WHERE id = $1`,
    [matchId]
  );
};
