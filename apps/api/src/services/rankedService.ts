import { randomUUID } from "crypto";
import { db } from "../db";
import { ensureUsersTable } from "./authService";
import type { MessageUser } from "./messageService";

export type RankedStatus =
  | { status: "matched"; matchId: string; partner: MessageUser; startedAt: string }
  | { status: "waiting" }
  | { status: "idle" };

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
      started_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS ranked_matches_user_idx
      ON ranked_matches (user_a_id, user_b_id, started_at DESC);
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
