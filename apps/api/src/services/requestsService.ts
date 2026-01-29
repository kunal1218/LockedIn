import { randomUUID } from "crypto";
import type { RequestCard } from "@lockedin/shared";
import { db } from "../db";
import { ensureUsersTable } from "./authService";
import { createRequestHelpNotification } from "./notificationService";

type RequestRow = {
  id: string;
  title: string;
  description: string;
  location: string;
  tags: string[] | null;
  urgency: string | null;
  created_at: string | Date;
  creator_id: string;
  creator_name: string;
  creator_handle: string;
  creator_college_name?: string | null;
  creator_college_domain?: string | null;
  like_count?: number | string | null;
  liked_by_user?: boolean | null;
};

export class RequestError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const normalizeTags = (tags: unknown): string[] => {
  if (!Array.isArray(tags)) {
    return [];
  }

  const cleaned = tags
    .map((tag) =>
      typeof tag === "string"
        ? tag.trim().replace(/^#/, "").replace(/\s+/g, "-").toLowerCase()
        : ""
    )
    .filter(Boolean);

  return Array.from(new Set(cleaned)).slice(0, 10);
};

const toIsoString = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const ensureRequestsTable = async () => {
  await ensureUsersTable();

  await db.query(`
    CREATE TABLE IF NOT EXISTS requests (
      id uuid PRIMARY KEY,
      creator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text NOT NULL,
      location text NOT NULL,
      tags text[] NOT NULL DEFAULT ARRAY[]::text[],
      urgency text NOT NULL DEFAULT 'low',
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS requests_created_at_idx
      ON requests (created_at DESC);
  `);
};

const ensureRequestLikesTable = async () => {
  await ensureRequestsTable();

  await db.query(`
    CREATE TABLE IF NOT EXISTS request_likes (
      request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (request_id, user_id)
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS request_likes_request_idx
      ON request_likes (request_id);
  `);
};

const ensureHelpOffersTable = async () => {
  await ensureRequestsTable();

  await db.query(`
    CREATE TABLE IF NOT EXISTS request_help_offers (
      request_id uuid NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
      helper_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (request_id, helper_id)
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS request_help_offers_request_idx
      ON request_help_offers (request_id);
  `);
};

const mapRequest = (row: RequestRow): RequestCard => ({
  id: row.id,
  title: row.title,
  description: row.description,
  location: row.location,
  createdAt: toIsoString(row.created_at),
  tags: row.tags ?? [],
  urgency: (row.urgency as RequestCard["urgency"]) ?? "low",
  creator: {
    id: row.creator_id,
    name: row.creator_name,
    handle: row.creator_handle,
    collegeName: row.creator_college_name ?? null,
    collegeDomain: row.creator_college_domain ?? null,
  },
  likeCount: Number(row.like_count ?? 0),
  likedByUser: Boolean(row.liked_by_user),
});

export const fetchRequests = async (params: {
  sinceHours?: number;
  order?: "newest" | "oldest";
  limit?: number;
  viewerId?: string | null;
} = {}): Promise<RequestCard[]> => {
  await ensureRequestsTable();
  await ensureRequestLikesTable();

  const conditions: string[] = [];
  const queryParams: Array<string | number | null> = [];

  if (params.sinceHours && Number.isFinite(params.sinceHours)) {
    conditions.push(
      `r.created_at >= now() - $${queryParams.length + 1}::interval`
    );
    queryParams.push(`${params.sinceHours} hours`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const orderBy = params.order === "oldest" ? "r.created_at ASC" : "r.created_at DESC";

  queryParams.push(params.limit ?? 50);
  const limitPosition = queryParams.length;

  queryParams.push(params.viewerId ?? null);
  const viewerPosition = queryParams.length;

  const result = await db.query(
    `SELECT r.id,
            r.title,
            r.description,
            r.location,
            r.tags,
            r.urgency,
            r.created_at,
            u.id AS creator_id,
            u.name AS creator_name,
            u.handle AS creator_handle,
            u.college_name AS creator_college_name,
            u.college_domain AS creator_college_domain,
            COUNT(l.user_id)::int AS like_count,
            BOOL_OR(l.user_id = $${viewerPosition}) AS liked_by_user
     FROM requests r
     JOIN users u ON u.id = r.creator_id
     LEFT JOIN request_likes l ON l.request_id = r.id
     ${where}
     GROUP BY r.id, u.id
     ORDER BY ${orderBy}
     LIMIT $${limitPosition}`,
    queryParams
  );

  return (result.rows as RequestRow[]).map(mapRequest);
};

export const createRequest = async (params: {
  creatorId: string;
  title: string;
  description: string;
  location: string;
  tags?: unknown;
  urgency?: string;
}): Promise<RequestCard> => {
  await ensureRequestsTable();

  const title = (params.title ?? "").trim();
  const description = (params.description ?? "").trim();
  const location = (params.location ?? "").trim();
  const tags = normalizeTags(params.tags ?? []);
  const urgency = (params.urgency ?? "low").toLowerCase();

  if (!title) {
    throw new RequestError("Title is required", 400);
  }
  if (!description) {
    throw new RequestError("Description is required", 400);
  }
  if (!location) {
    throw new RequestError("Location is required", 400);
  }

  if (!["low", "medium", "high"].includes(urgency)) {
    throw new RequestError("Urgency must be low, medium, or high", 400);
  }

  const id = randomUUID();

  await db.query(
    `INSERT INTO requests (id, creator_id, title, description, location, tags, urgency)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, params.creatorId, title, description, location, tags, urgency]
  );

  const result = await db.query(
    `SELECT r.id,
            r.title,
            r.description,
            r.location,
            r.tags,
            r.urgency,
            r.created_at,
            u.id AS creator_id,
            u.name AS creator_name,
            u.handle AS creator_handle,
            u.college_name AS creator_college_name,
            u.college_domain AS creator_college_domain
     FROM requests r
     JOIN users u ON u.id = r.creator_id
     WHERE r.id = $1`,
    [id]
  );

  return mapRequest(result.rows[0] as RequestRow);
};

export const toggleRequestLike = async (params: {
  requestId: string;
  userId: string;
}): Promise<{ likeCount: number; liked: boolean }> => {
  await ensureRequestLikesTable();

  const existing = await db.query(
    `SELECT 1 FROM request_likes WHERE request_id = $1 AND user_id = $2 LIMIT 1`,
    [params.requestId, params.userId]
  );

  let liked = true;
  if ((existing.rowCount ?? 0) > 0) {
    await db.query(
      `DELETE FROM request_likes WHERE request_id = $1 AND user_id = $2`,
      [params.requestId, params.userId]
    );
    liked = false;
  } else {
    await db.query(
      `INSERT INTO request_likes (request_id, user_id) VALUES ($1, $2)`,
      [params.requestId, params.userId]
    );
  }

  const countResult = await db.query(
    `SELECT COUNT(*)::int AS like_count FROM request_likes WHERE request_id = $1`,
    [params.requestId]
  );
  const likeCount = Number(countResult.rows[0]?.like_count ?? 0);

  return { likeCount, liked };
};

export const recordHelpOffer = async (params: {
  requestId: string;
  helperId: string;
}): Promise<void> => {
  await ensureHelpOffersTable();

  const requestResult = await db.query(
    `SELECT r.id,
            r.title,
            r.description,
            r.location,
            r.tags,
            r.urgency,
            r.created_at,
            r.creator_id,
            u.name AS creator_name,
            u.handle AS creator_handle,
            u.college_name AS creator_college_name,
            u.college_domain AS creator_college_domain
     FROM requests r
     JOIN users u ON u.id = r.creator_id
     WHERE r.id = $1
     LIMIT 1`,
    [params.requestId]
  );

  if ((requestResult.rowCount ?? 0) === 0) {
    throw new RequestError("Request not found", 404);
  }

  const request = requestResult.rows[0] as RequestRow;

  if (request.creator_id === params.helperId) {
    throw new RequestError("You cannot help your own request", 400);
  }

  const insertResult = await db.query(
    `INSERT INTO request_help_offers (request_id, helper_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING 1`,
    [params.requestId, params.helperId]
  );

  if ((insertResult.rowCount ?? 0) === 0) {
    return;
  }

  await createRequestHelpNotification({
    recipientId: request.creator_id,
    actorId: params.helperId,
    requestId: request.id,
    requestTitle: request.title,
    requestDescription: request.description,
  });
};
