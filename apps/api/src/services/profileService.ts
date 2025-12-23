import { profile } from "./mockData";
import { db } from "../db";
import { ensureUsersTable } from "./authService";
import { getProfileAnswers } from "./profileAnswersService";

type PublicProfileUserRow = {
  id: string;
  name: string;
  handle: string;
  college_name?: string | null;
  college_domain?: string | null;
};

const normalizeHandle = (value: string) => {
  const cleaned = value.trim().toLowerCase().replace(/^@/, "");
  const sanitized = cleaned.replace(/[^a-z0-9_]/g, "");
  if (!sanitized) {
    return "";
  }
  return `@${sanitized}`;
};

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    value
  );

export const fetchProfile = async () => {
  return profile;
};

export const fetchPublicProfileByHandle = async (handle: string) => {
  await ensureUsersTable();
  const trimmed = handle.trim();
  if (!trimmed) {
    return null;
  }

  let result;
  if (isUuid(trimmed)) {
    result = await db.query(
      "SELECT id, name, handle, college_name, college_domain FROM users WHERE id = $1",
      [trimmed]
    );
  } else {
    const normalized = normalizeHandle(trimmed);
    if (!normalized) {
      return null;
    }
    result = await db.query(
      "SELECT id, name, handle, college_name, college_domain FROM users WHERE handle = $1",
      [normalized]
    );
  }

  if ((result.rowCount ?? 0) === 0) {
    return null;
  }

  const row = result.rows[0] as PublicProfileUserRow;
  const answers = await getProfileAnswers(row.id);

  return {
    user: {
      id: row.id,
      name: row.name,
      handle: row.handle,
      collegeName: row.college_name ?? null,
      collegeDomain: row.college_domain ?? null,
    },
    answers,
  };
};
