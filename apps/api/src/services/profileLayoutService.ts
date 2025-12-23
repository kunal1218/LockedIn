import { db } from "../db";
import { ensureUsersTable } from "./authService";

export type LayoutMode = "default" | "compact";

export type ProfileLayout = {
  mode: LayoutMode;
  positions: Record<string, { x: number; y: number }>;
  updatedAt: string;
};

type ProfileLayoutRow = {
  mode: LayoutMode;
  positions: Record<string, { x: number; y: number }>;
  updated_at: string | Date;
};

export class ProfileLayoutError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const ensureProfileLayoutTable = async () => {
  await ensureUsersTable();

  await db.query(`
    CREATE TABLE IF NOT EXISTS profile_layouts (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mode text NOT NULL,
      positions jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, mode)
    );
  `);
};

const toIsoString = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const normalizeMode = (value: unknown): LayoutMode => {
  if (value === "compact") {
    return "compact";
  }
  return "default";
};

const normalizePositions = (
  value: unknown
): Record<string, { x: number; y: number }> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProfileLayoutError("Layout positions are required.", 400);
  }

  const entries = Object.entries(value as Record<string, unknown>);
  const positions: Record<string, { x: number; y: number }> = {};

  entries.forEach(([key, position]) => {
    if (!position || typeof position !== "object") {
      return;
    }

    const x = Number((position as { x?: unknown }).x);
    const y = Number((position as { y?: unknown }).y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      positions[key] = { x, y };
    }
  });

  if (Object.keys(positions).length === 0) {
    throw new ProfileLayoutError("Layout positions are required.", 400);
  }

  return positions;
};

export const saveProfileLayout = async (params: {
  userId: string;
  mode: unknown;
  positions: unknown;
}): Promise<ProfileLayout> => {
  await ensureProfileLayoutTable();
  const mode = normalizeMode(params.mode);
  const positions = normalizePositions(params.positions);

  const positionsJson = JSON.stringify(positions);

  const result = await db.query(
    `INSERT INTO profile_layouts (user_id, mode, positions)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (user_id, mode)
     DO UPDATE SET positions = $3::jsonb, updated_at = now()
     RETURNING mode, positions, updated_at`,
    [params.userId, mode, positionsJson]
  );

  const row = result.rows[0] as ProfileLayoutRow;
  return {
    mode: row.mode,
    positions: row.positions ?? {},
    updatedAt: toIsoString(row.updated_at),
  };
};

export const fetchProfileLayout = async (params: {
  userId: string;
  mode?: LayoutMode;
}): Promise<ProfileLayout | null> => {
  await ensureProfileLayoutTable();
  const mode = params.mode ?? "default";

  const result = await db.query(
    `SELECT mode, positions, updated_at
     FROM profile_layouts
     WHERE user_id = $1 AND mode = $2`,
    [params.userId, mode]
  );

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  const row = result.rows[0] as ProfileLayoutRow;
  return {
    mode: row.mode,
    positions: row.positions ?? {},
    updatedAt: toIsoString(row.updated_at),
  };
};
