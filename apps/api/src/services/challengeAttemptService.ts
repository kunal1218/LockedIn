import { randomUUID } from "crypto";
import { db } from "../db";
import { ensureUsersTable } from "./authService";

export type ChallengeAttempt = {
  id: string;
  type: "daily-challenge";
  challengeId: string;
  challengeTitle: string;
  imageData: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    handle: string;
    email: string;
  };
};

type ChallengeAttemptRow = {
  id: string;
  challenge_id: string;
  challenge_title: string;
  image_data: string;
  created_at: string | Date;
  user_id: string;
  user_name: string;
  user_handle: string;
  user_email: string;
};

export class ChallengeAttemptError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_DATA_PREFIX = /^data:image\/[a-z0-9.+-]+;base64,/i;

const ensureChallengeAttemptTable = async () => {
  await ensureUsersTable();

  await db.query(`
    CREATE TABLE IF NOT EXISTS challenge_attempts (
      id uuid PRIMARY KEY,
      challenge_id text NOT NULL,
      challenge_title text NOT NULL,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      image_data text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS challenge_attempts_created_at_idx
      ON challenge_attempts (created_at DESC);
  `);
};

const toIsoString = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const assertValidImageData = (imageData: string) => {
  if (!imageData) {
    throw new ChallengeAttemptError("Image data is required.", 400);
  }

  if (!IMAGE_DATA_PREFIX.test(imageData)) {
    throw new ChallengeAttemptError(
      "Please upload a valid image file.",
      400
    );
  }

  const base64 = imageData.split(",")[1] ?? "";
  if (!base64) {
    throw new ChallengeAttemptError(
      "Please upload a valid image file.",
      400
    );
  }

  const byteLength = Buffer.from(base64, "base64").length;
  if (byteLength > MAX_IMAGE_BYTES) {
    throw new ChallengeAttemptError(
      "Image is too large. Please upload something under 2MB.",
      413
    );
  }
};

export const createChallengeAttempt = async (params: {
  userId: string;
  challengeId: string;
  challengeTitle: string;
  imageData: string;
}): Promise<ChallengeAttempt> => {
  await ensureChallengeAttemptTable();
  assertValidImageData(params.imageData);

  const attemptId = randomUUID();

  await db.query(
    `INSERT INTO challenge_attempts (id, challenge_id, challenge_title, user_id, image_data)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      attemptId,
      params.challengeId,
      params.challengeTitle,
      params.userId,
      params.imageData,
    ]
  );

  const result = await db.query(
    `SELECT attempts.id,
            attempts.challenge_id,
            attempts.challenge_title,
            attempts.image_data,
            attempts.created_at,
            users.id AS user_id,
            users.name AS user_name,
            users.handle AS user_handle,
            users.email AS user_email
     FROM challenge_attempts attempts
     JOIN users ON users.id = attempts.user_id
     WHERE attempts.id = $1`,
    [attemptId]
  );

  const row = result.rows[0] as ChallengeAttemptRow;
  return {
    id: row.id,
    type: "daily-challenge",
    challengeId: row.challenge_id,
    challengeTitle: row.challenge_title,
    imageData: row.image_data,
    createdAt: toIsoString(row.created_at),
    user: {
      id: row.user_id,
      name: row.user_name,
      handle: row.user_handle,
      email: row.user_email,
    },
  };
};

export const fetchChallengeAttempts = async (): Promise<ChallengeAttempt[]> => {
  await ensureChallengeAttemptTable();

  const result = await db.query(
    `SELECT attempts.id,
            attempts.challenge_id,
            attempts.challenge_title,
            attempts.image_data,
            attempts.created_at,
            users.id AS user_id,
            users.name AS user_name,
            users.handle AS user_handle,
            users.email AS user_email
     FROM challenge_attempts attempts
     JOIN users ON users.id = attempts.user_id
     ORDER BY attempts.created_at DESC`
  );

  return (result.rows as ChallengeAttemptRow[]).map((row) => ({
    id: row.id,
    type: "daily-challenge",
    challengeId: row.challenge_id,
    challengeTitle: row.challenge_title,
    imageData: row.image_data,
    createdAt: toIsoString(row.created_at),
    user: {
      id: row.user_id,
      name: row.user_name,
      handle: row.user_handle,
      email: row.user_email,
    },
  }));
};

export const fetchChallengeAttemptsByChallengeId = async (
  challengeId: string
): Promise<ChallengeAttempt[]> => {
  await ensureChallengeAttemptTable();

  const result = await db.query(
    `SELECT attempts.id,
            attempts.challenge_id,
            attempts.challenge_title,
            attempts.image_data,
            attempts.created_at,
            users.id AS user_id,
            users.name AS user_name,
            users.handle AS user_handle,
            users.email AS user_email
     FROM challenge_attempts attempts
     JOIN users ON users.id = attempts.user_id
     WHERE attempts.challenge_id = $1
     ORDER BY attempts.created_at DESC`,
    [challengeId]
  );

  return (result.rows as ChallengeAttemptRow[]).map((row) => ({
    id: row.id,
    type: "daily-challenge",
    challengeId: row.challenge_id,
    challengeTitle: row.challenge_title,
    imageData: row.image_data,
    createdAt: toIsoString(row.created_at),
    user: {
      id: row.user_id,
      name: row.user_name,
      handle: row.user_handle,
      email: row.user_email,
    },
  }));
};
