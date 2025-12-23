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
};

export type AuthUser = {
  id: string;
  name: string;
  handle: string;
  email: string;
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

export const ensureUsersTable = async () => {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      handle text NOT NULL UNIQUE,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
  `);
};

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const normalizeHandle = (handle: string) => {
  const cleaned = handle.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (!cleaned) {
    return "";
  }
  return `@${cleaned}`;
};

const mapUser = (row: Pick<UserRow, "id" | "name" | "handle" | "email">) => ({
  id: row.id,
  name: row.name,
  handle: row.handle,
  email: row.email,
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

  const result = await db.query(
    `INSERT INTO users (id, name, handle, email, password_hash)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, handle, email`,
    [userId, name, handle, email, passwordHash]
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
    "SELECT id, name, handle, email, password_hash FROM users WHERE email = $1",
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
    "SELECT id, name, handle, email FROM users WHERE id = $1",
    [userId]
  );
  const row = result.rows[0] as AuthUser | undefined;

  return row ? mapUser(row) : null;
};
