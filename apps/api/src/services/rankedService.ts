import { randomUUID } from "crypto";
import { db } from "../db";
import { ensureUsersTable } from "./authService";
import type { MessageUser } from "./messageService";

export type RankedStatus =
  | { status: "matched"; matchId: string; partner: MessageUser; startedAt: string }
  | { status: "waiting" }
  | { status: "idle" };

export type RankedMessage = {
  id: string;
  body: string;
  createdAt: string;
  sender: MessageUser;
};

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
      timed_out boolean NOT NULL DEFAULT false
    );
  `);

  await db.query(`
    ALTER TABLE ranked_matches
    ADD COLUMN IF NOT EXISTS timed_out boolean NOT NULL DEFAULT false;
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
      created_at timestamptz NOT NULL DEFAULT now()
    );
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
  await db.query(
    `INSERT INTO ranked_matches (id, user_a_id, user_b_id) VALUES ($1, $2, $3)`,
    [matchId, userId, partnerId]
  );
  return matchId;
};

const getMatch = async (matchId: string) => {
  const result = await db.query(
    `SELECT id, user_a_id, user_b_id, started_at, timed_out
     FROM ranked_matches WHERE id = $1 LIMIT 1`,
    [matchId]
  );
  if ((result.rowCount ?? 0) === 0) {
    return null;
  }
  return result.rows[0] as {
    id: string;
    user_a_id: string;
    user_b_id: string;
    started_at: string | Date;
    timed_out: boolean;
  };
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

  // Remove stale queue entry for the same user to avoid duplicates.
  await removeFromQueue(userId);

  const partnerId = await findWaitingPartner(userId);

  if (partnerId) {
    // Pair with the oldest waiting partner.
    await removeFromQueue(partnerId);
    const matchId = await createMatch(userId, partnerId);
    const partner = await fetchUserById(partnerId);
    return {
      status: "matched",
      matchId,
      partner,
      startedAt: new Date().toISOString(),
    };
  }

  await enqueueUser(userId);
  return { status: "waiting" };
};

export const getRankedStatusForUser = async (userId: string): Promise<RankedStatus> => {
  await ensureRankedTables();

  const matchResult = await db.query(
    `SELECT id, user_a_id, user_b_id, started_at
     FROM ranked_matches
     WHERE user_a_id = $1 OR user_b_id = $1
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
    };
    const partnerId = row.user_a_id === userId ? row.user_b_id : row.user_a_id;
    const partner = await fetchUserById(partnerId);
    return {
      status: "matched",
      matchId: row.id,
      partner,
      startedAt:
        row.started_at instanceof Date
          ? row.started_at.toISOString()
          : new Date(row.started_at).toISOString(),
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
): Promise<{ messages: RankedMessage[]; timedOut: boolean }> => {
  await ensureRankedTables();
  const { match } = await assertParticipant(matchId, userId);

  const result = await db.query(
    `SELECT m.id,
            m.body,
            m.created_at,
            sender.id AS sender_id,
            sender.name AS sender_name,
            sender.handle AS sender_handle
     FROM ranked_messages m
     JOIN users sender ON sender.id = m.sender_id
     WHERE m.match_id = $1
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
  }));

  return { messages, timedOut: match.timed_out };
};

export const sendRankedMessage = async (params: {
  matchId: string;
  senderId: string;
  body: string;
}): Promise<RankedMessage> => {
  await ensureRankedTables();
  const { match } = await assertParticipant(params.matchId, params.senderId);
  if (match.timed_out) {
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
    `INSERT INTO ranked_messages (id, match_id, sender_id, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id, match_id, sender_id, body, created_at`,
    [id, params.matchId, params.senderId, trimmed]
  );

  const row = result.rows[0] as {
    id: string;
    match_id: string;
    sender_id: string;
    body: string;
    created_at: string | Date;
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
  };
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
