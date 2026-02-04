import type { Request, Response } from "express";
import { AuthError, getUserFromToken, ensureUsersTable } from "../services/authService";
import {
  ChallengeAttemptError,
  fetchChallengeAttempts,
} from "../services/challengeAttemptService";
import { db } from "../db";

const getToken = (req: Request) => {
  const header = req.header("authorization");
  if (!header) {
    return null;
  }

  const [type, token] = header.split(" ");
  if (type?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token.trim();
};

const requireUser = async (req: Request) => {
  const token = getToken(req);
  if (!token) {
    throw new AuthError("Missing session token", 401);
  }

  const user = await getUserFromToken(token);
  if (!user) {
    throw new AuthError("Invalid session", 401);
  }

  return user;
};

const requireAdmin = async (req: Request) => {
  const user = await requireUser(req);
  if (!user.isAdmin) {
    throw new AuthError("Admin access required", 403);
  }
  return user;
};

class AdminActionError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );

const parseBanDuration = (value: unknown) => {
  if (typeof value !== "string") {
    throw new AdminActionError("Ban duration is required", 400);
  }
  const normalized = value.trim().toLowerCase();
  if (["1d", "day", "1day", "24h"].includes(normalized)) {
    return "day";
  }
  if (["1w", "week", "7d", "7days"].includes(normalized)) {
    return "week";
  }
  if (["1m", "month", "30d", "30days"].includes(normalized)) {
    return "month";
  }
  if (["forever", "indefinite", "permanent"].includes(normalized)) {
    return "forever";
  }
  if (["unban", "clear", "none"].includes(normalized)) {
    return "unban";
  }
  throw new AdminActionError("Invalid ban duration", 400);
};

const buildBanResponse = (row: {
  banned_until?: string | Date | null;
  banned_indefinitely?: boolean | null;
}) => {
  const isIndefinite = Boolean(row.banned_indefinitely);
  const until = row.banned_until
    ? row.banned_until instanceof Date
      ? row.banned_until.toISOString()
      : new Date(row.banned_until).toISOString()
    : null;
  const isActive =
    isIndefinite || (until ? new Date(until).getTime() > Date.now() : false);
  return { isActive, until, isIndefinite };
};

const handleError = (res: Response, error: unknown) => {
  if (
    error instanceof AuthError ||
    error instanceof ChallengeAttemptError ||
    error instanceof AdminActionError
  ) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Admin error:", error);
  res.status(500).json({ error: "Unable to load admin dashboard" });
};

export const getChallengeAttemptsAdmin = async (req: Request, res: Response) => {
  try {
    await requireAdmin(req);
    const submissions = await fetchChallengeAttempts();
    res.json({ submissions });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateUserBan = async (req: Request, res: Response) => {
  try {
    const admin = await requireAdmin(req);
    const userId = typeof req.params?.userId === "string" ? req.params.userId : "";
    if (!userId || !isUuid(userId)) {
      throw new AdminActionError("Invalid user ID", 400);
    }
    if (admin.id === userId) {
      throw new AdminActionError("Admins cannot ban themselves", 400);
    }

    const duration = parseBanDuration(req.body?.duration);
    await ensureUsersTable();

    let result;
    if (duration === "unban") {
      result = await db.query(
        `UPDATE users
         SET banned_until = NULL,
             banned_indefinitely = false
         WHERE id = $1
         RETURNING banned_until, banned_indefinitely`,
        [userId]
      );
    } else if (duration === "forever") {
      result = await db.query(
        `UPDATE users
         SET banned_until = NULL,
             banned_indefinitely = true
         WHERE id = $1
         RETURNING banned_until, banned_indefinitely`,
        [userId]
      );
    } else {
      const interval =
        duration === "day" ? "1 day" : duration === "week" ? "7 days" : "1 month";
      result = await db.query(
        `UPDATE users
         SET banned_until = now() + interval '${interval}',
             banned_indefinitely = false
         WHERE id = $1
         RETURNING banned_until, banned_indefinitely`,
        [userId]
      );
    }

    if ((result.rowCount ?? 0) === 0) {
      throw new AdminActionError("User not found", 404);
    }

    const row = result.rows[0] as {
      banned_until?: string | Date | null;
      banned_indefinitely?: boolean | null;
    };
    res.json({ ban: buildBanResponse(row) });
  } catch (error) {
    handleError(res, error);
  }
};
