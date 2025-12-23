import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { db } from "../db";
import { getRedis } from "../db/redis";

type UserRow = {
  id: string;
  name: string;
  handle: string;
  email: string;
  password_hash: string;
  college_name?: string | null;
  college_domain?: string | null;
};

export type AuthUser = {
  id: string;
  name: string;
  handle: string;
  email: string;
  collegeName?: string | null;
  collegeDomain?: string | null;
  isAdmin?: boolean;
};

export type AuthPayload = {
  user: AuthUser;
  token: string;
};

export class AuthError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
let didBackfillHandles = false;
let cachedAdminEmails: Set<string> | null = null;

const getAdminEmails = () => {
  if (cachedAdminEmails) {
    return cachedAdminEmails;
  }

  const raw = process.env.LOCKEDIN_ADMIN_EMAILS ?? "";
  const emails = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  cachedAdminEmails = new Set(emails);
  return cachedAdminEmails;
};

const isAdminEmail = (email: string) =>
  getAdminEmails().has(email.trim().toLowerCase());

export const ensureUsersTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      handle text NOT NULL UNIQUE,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      college_name text,
      college_domain text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS college_name text,
    ADD COLUMN IF NOT EXISTS college_domain text;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS users_college_domain_idx
      ON users (college_domain);
  `);

  await backfillInvalidHandles();
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const toCollegeName = (slug: string) => {
  const cleaned = slug.replace(/[-_]+/g, " ").trim();
  if (!cleaned) {
    return "";
  }

  const compact = cleaned.replace(/\s+/g, "");
  if (compact.length <= 4) {
    return compact.toUpperCase();
  }

  return cleaned
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export const deriveCollegeFromEmail = (email: string) => {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  const parts = domain.split(".").filter(Boolean);
  if (parts.length < 2) {
    return null;
  }

  const tld = parts[parts.length - 1];
  const secondLevel = parts[parts.length - 2];
  let collegeDomain = "";
  let slug = "";

  if (tld === "edu" && parts.length >= 2) {
    slug = parts[parts.length - 2];
    collegeDomain = parts.slice(-2).join(".");
  } else if (secondLevel === "edu" && tld.length === 2 && parts.length >= 3) {
    slug = parts[parts.length - 3];
    collegeDomain = parts.slice(-3).join(".");
  } else if (secondLevel === "ac" && tld.length === 2 && parts.length >= 3) {
    slug = parts[parts.length - 3];
    collegeDomain = parts.slice(-3).join(".");
  } else {
    return null;
  }

  const name = toCollegeName(slug);
  if (!name || !collegeDomain) {
    return null;
  }

  return { name, domain: collegeDomain };
};

const normalizeHandle = (handle: string) => {
  const cleaned = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!cleaned) {
    return "";
  }
  return `@${cleaned}`;
};

const isHandleAvailable = async (handle: string, userId: string) => {
  const result = await db.query(
    "SELECT 1 FROM users WHERE handle = $1 AND id <> $2",
    [handle, userId]
  );
  return (result.rowCount ?? 0) === 0;
};

const mapUser = (
  row: Pick<
    UserRow,
    "id" | "name" | "handle" | "email" | "college_name" | "college_domain"
  >
) => ({
  id: row.id,
  name: row.name,
  handle: row.handle,
  email: row.email,
  collegeName: row.college_name ?? null,
  collegeDomain: row.college_domain ?? null,
  isAdmin: isAdminEmail(row.email),
});

const handleExists = async (handle: string) => {
  const result = await db.query("SELECT 1 FROM users WHERE handle = $1", [
    handle,
  ]);
  return (result.rowCount ?? 0) > 0;
};

const generateHandle = async (name: string) => {
  const base = normalizeHandle(name) || "@user";
  if (!(await handleExists(base))) {
    return base;
  }

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const candidate = `${base}${suffix}`;
    if (!(await handleExists(candidate))) {
      return candidate;
    }
  }

  return `${base}${randomUUID().slice(0, 6)}`;
};

const backfillInvalidHandles = async () => {
  if (didBackfillHandles) {
    return;
  }

  const result = await db.query(
    `SELECT id, name, handle
     FROM users
     WHERE handle IS NULL
        OR BTRIM(handle) = ''
        OR handle !~ '^@[a-z0-9_]+$'`
  );

  for (const row of result.rows as Array<{
    id: string;
    name: string;
    handle?: string | null;
  }>) {
    const normalized = normalizeHandle(row.handle ?? "");
    let candidate = "";

    if (normalized && (await isHandleAvailable(normalized, row.id))) {
      candidate = normalized;
    } else {
      candidate = await generateHandle(row.name || "user");
    }

    if (candidate) {
      await db.query("UPDATE users SET handle = $2 WHERE id = $1", [
        row.id,
        candidate,
      ]);
    }
  }

  didBackfillHandles = true;
};

const createSession = async (userId: string) => {
  const redis = await getRedis();
  if (!redis) {
    throw new AuthError("REDIS_URL is not configured", 500);
  }

  const token = randomUUID();
  await redis.set(`session:${token}`, JSON.stringify({ userId }), {
    EX: SESSION_TTL_SECONDS,
  });
  return token;
};

export const signUpUser = async (params: {
  name: string;
  email: string;
  password: string;
  handle?: string;
}): Promise<AuthPayload> => {
  await ensureUsersTable();

  const name = params.name.trim();
  const email = normalizeEmail(params.email);

  if (!name) {
    throw new AuthError("Name is required", 400);
  }
  if (!email) {
    throw new AuthError("Email is required", 400);
  }
  if (params.password.length < 8) {
    throw new AuthError("Password must be at least 8 characters", 400);
  }

  const existing = await db.query("SELECT 1 FROM users WHERE email = $1", [
    email,
  ]);
  if ((existing.rowCount ?? 0) > 0) {
    throw new AuthError("Email is already in use", 409);
  }

  let handle = params.handle ? normalizeHandle(params.handle) : "";
  if (handle) {
    if (await handleExists(handle)) {
      throw new AuthError("Handle is already taken", 409);
    }
  } else {
    handle = await generateHandle(name);
  }

  const passwordHash = await bcrypt.hash(params.password, 10);
  const userId = randomUUID();
  const college = deriveCollegeFromEmail(email);

  const result = await db.query(
    `INSERT INTO users (id, name, handle, email, password_hash, college_name, college_domain)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, name, handle, email, college_name, college_domain`,
    [
      userId,
      name,
      handle,
      email,
      passwordHash,
      college?.name ?? null,
      college?.domain ?? null,
    ]
  );

  const user = mapUser(result.rows[0]);
  const token = await createSession(user.id);

  return { user, token };
};

export const signInUser = async (params: {
  email: string;
  password: string;
}): Promise<AuthPayload> => {
  await ensureUsersTable();

  const email = normalizeEmail(params.email);

  if (!email || !params.password) {
    throw new AuthError("Email and password are required", 400);
  }

  const result = await db.query(
    "SELECT id, name, handle, email, password_hash, college_name, college_domain FROM users WHERE email = $1",
    [email]
  );
  const row = result.rows[0] as UserRow | undefined;

  if (!row) {
    throw new AuthError("Invalid email or password", 401);
  }

  const matches = await bcrypt.compare(params.password, row.password_hash);
  if (!matches) {
    throw new AuthError("Invalid email or password", 401);
  }

  if (!row.college_domain || !row.college_name) {
    const college = deriveCollegeFromEmail(row.email);
    if (college) {
      const refreshed = await db.query(
        `UPDATE users
         SET college_name = $2, college_domain = $3
         WHERE id = $1
         RETURNING id, name, handle, email, college_name, college_domain`,
        [row.id, college.name, college.domain]
      );
      const updated = refreshed.rows[0] as UserRow | undefined;
      if (updated) {
        row.college_name = updated.college_name ?? null;
        row.college_domain = updated.college_domain ?? null;
      }
    }
  }

  const user = mapUser(row);
  const token = await createSession(user.id);

  return { user, token };
};

export const getUserFromToken = async (
  token: string
): Promise<AuthUser | null> => {
  await ensureUsersTable();
  const redis = await getRedis();
  if (!redis) {
    throw new AuthError("REDIS_URL is not configured", 500);
  }

  const session = await redis.get(`session:${token}`);
  if (!session) {
    return null;
  }

  const { userId } = JSON.parse(session) as { userId: string };
  const result = await db.query(
    "SELECT id, name, handle, email, college_name, college_domain FROM users WHERE id = $1",
    [userId]
  );
  const row = result.rows[0] as UserRow | undefined;
  if (!row) {
    return null;
  }

  if (!row.college_domain || !row.college_name) {
    const college = deriveCollegeFromEmail(row.email);
    if (college) {
      const refreshed = await db.query(
        `UPDATE users
         SET college_name = $2, college_domain = $3
         WHERE id = $1
         RETURNING id, name, handle, email, college_name, college_domain`,
        [row.id, college.name, college.domain]
      );
      const updated = refreshed.rows[0] as UserRow | undefined;
      if (updated) {
        row.college_name = updated.college_name ?? null;
        row.college_domain = updated.college_domain ?? null;
      }
    }
  }

  return mapUser(row);
};
