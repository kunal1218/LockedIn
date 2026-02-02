import { db } from "../db";
import { ensureUsersTable } from "./authService";
import { ensureFriendTables } from "./friendService";

export type MapSettings = {
  shareLocation: boolean;
  ghostMode: boolean;
};

export type FriendLocation = {
  id: string;
  name: string;
  handle: string;
  latitude: number;
  longitude: number;
  lastUpdated: string;
  profilePictureUrl?: string | null;
  bio?: string | null;
  previousLatitude?: number | null;
  previousLongitude?: number | null;
};

type MapSettingsRow = {
  share_location: boolean;
  ghost_mode: boolean;
};

type FriendLocationRow = {
  id: string;
  name: string;
  handle: string;
  profile_picture_url?: string | null;
  bio?: string | null;
  latitude: number | string;
  longitude: number | string;
  updated_at: string | Date;
  previous_latitude?: number | string | null;
  previous_longitude?: number | string | null;
};

export class MapError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const LOCATION_TTL_MINUTES = 30;

const ensureLocationTable = async () => {
  await ensureUsersTable();
  await ensureLocationHistoryTable();

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_locations (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      latitude double precision,
      longitude double precision,
      share_location boolean NOT NULL DEFAULT false,
      ghost_mode boolean NOT NULL DEFAULT false,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS user_locations_updated_at_idx
      ON user_locations (updated_at DESC);
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS user_locations_share_idx
      ON user_locations (share_location, ghost_mode);
  `);
};

const ensureLocationHistoryTable = async () => {
  await ensureUsersTable();

  await db.query(`
    CREATE TABLE IF NOT EXISTS user_location_history (
      id bigserial PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      latitude double precision,
      longitude double precision,
      updated_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS user_location_history_user_idx
      ON user_location_history (user_id, updated_at DESC);
  `);
};

const toIsoString = (value: string | Date) =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const mapSettings = (row?: MapSettingsRow | null): MapSettings => ({
  shareLocation: row?.share_location ?? false,
  ghostMode: row?.ghost_mode ?? false,
});

export const getMapSettings = async (userId: string): Promise<MapSettings> => {
  await ensureLocationTable();

  const result = await db.query(
    "SELECT share_location, ghost_mode FROM user_locations WHERE user_id = $1",
    [userId]
  );

  if ((result.rowCount ?? 0) === 0) {
    return mapSettings(null);
  }

  return mapSettings(result.rows[0] as MapSettingsRow);
};

export const updateMapSettings = async (
  userId: string,
  updates: Partial<MapSettings>
): Promise<MapSettings> => {
  await ensureLocationTable();

  const current = await getMapSettings(userId);
  const shareLocation =
    typeof updates.shareLocation === "boolean"
      ? updates.shareLocation
      : current.shareLocation;
  const ghostMode =
    typeof updates.ghostMode === "boolean"
      ? updates.ghostMode
      : current.ghostMode;

  const result = await db.query(
    `INSERT INTO user_locations (user_id, share_location, ghost_mode)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id)
     DO UPDATE SET share_location = $2, ghost_mode = $3
     RETURNING share_location, ghost_mode`,
    [userId, shareLocation, ghostMode]
  );

  return mapSettings(result.rows[0] as MapSettingsRow);
};

export const upsertUserLocation = async (params: {
  userId: string;
  latitude: number;
  longitude: number;
}): Promise<void> => {
  await ensureLocationTable();

  const settings = await getMapSettings(params.userId);
  if (!settings.shareLocation) {
    throw new MapError("Enable location sharing first.", 403);
  }

  await db.query(
    `INSERT INTO user_locations (user_id, latitude, longitude, share_location, ghost_mode)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id)
     DO UPDATE SET latitude = $2, longitude = $3, updated_at = now()`,
    [
      params.userId,
      params.latitude,
      params.longitude,
      settings.shareLocation,
      settings.ghostMode,
    ]
  );

  await db.query(
    `INSERT INTO user_location_history (user_id, latitude, longitude)
     VALUES ($1, $2, $3)`,
    [params.userId, params.latitude, params.longitude]
  );
};

export const fetchFriendLocations = async (
  userId: string
): Promise<FriendLocation[]> => {
  await ensureLocationTable();
  await ensureFriendTables();

  const result = await db.query(
    `WITH friend_ids AS (
       SELECT
         CASE
           WHEN fr.requester_id = $1 THEN fr.recipient_id
           ELSE fr.requester_id
         END AS friend_id
       FROM friend_requests fr
       WHERE fr.status = 'accepted'
         AND (fr.requester_id = $1 OR fr.recipient_id = $1)
     ),
     unblocked AS (
       SELECT friend_id
       FROM friend_ids f
       LEFT JOIN friend_blocks b1
         ON b1.blocker_id = $1 AND b1.blocked_id = f.friend_id
       LEFT JOIN friend_blocks b2
         ON b2.blocker_id = f.friend_id AND b2.blocked_id = $1
       WHERE b1.blocker_id IS NULL AND b2.blocker_id IS NULL
     )
     SELECT users.id,
            users.name,
            users.handle,
            users.profile_picture_url,
            users.bio,
            locations.latitude,
            locations.longitude,
            locations.updated_at,
            prev.latitude AS previous_latitude,
            prev.longitude AS previous_longitude
     FROM unblocked
     JOIN user_locations locations ON locations.user_id = unblocked.friend_id
     JOIN users ON users.id = unblocked.friend_id
     LEFT JOIN LATERAL (
       SELECT latitude, longitude
       FROM user_location_history history
       WHERE history.user_id = locations.user_id
       ORDER BY history.updated_at DESC
       OFFSET 1
       LIMIT 1
     ) prev ON true
     WHERE locations.share_location = true
       AND locations.ghost_mode = false
       AND locations.latitude IS NOT NULL
       AND locations.longitude IS NOT NULL
       AND locations.updated_at >= now() - INTERVAL '${LOCATION_TTL_MINUTES} minutes'
     ORDER BY locations.updated_at DESC`,
    [userId]
  );

  const friends = (result.rows as FriendLocationRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    handle: row.handle,
    profilePictureUrl: row.profile_picture_url ?? null,
    bio: row.bio ?? null,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    lastUpdated: toIsoString(row.updated_at),
    previousLatitude:
      row.previous_latitude != null ? Number(row.previous_latitude) : null,
    previousLongitude:
      row.previous_longitude != null ? Number(row.previous_longitude) : null,
  }));

  const selfResult = await db.query(
    `SELECT users.id,
            users.name,
            users.handle,
            users.profile_picture_url,
            users.bio,
            locations.latitude,
            locations.longitude,
            locations.updated_at,
            prev.latitude AS previous_latitude,
            prev.longitude AS previous_longitude
     FROM user_locations locations
     JOIN users ON users.id = locations.user_id
     LEFT JOIN LATERAL (
       SELECT latitude, longitude
       FROM user_location_history history
       WHERE history.user_id = locations.user_id
       ORDER BY history.updated_at DESC
       OFFSET 1
       LIMIT 1
     ) prev ON true
     WHERE locations.user_id = $1
       AND locations.share_location = true
       AND locations.ghost_mode = false
       AND locations.latitude IS NOT NULL
       AND locations.longitude IS NOT NULL
       AND locations.updated_at >= now() - INTERVAL '${LOCATION_TTL_MINUTES} minutes'
     LIMIT 1`,
    [userId]
  );

  if ((selfResult.rowCount ?? 0) > 0) {
    const row = selfResult.rows[0] as FriendLocationRow;
    const alreadyIncluded = friends.some((friend) => friend.id === row.id);
    if (!alreadyIncluded) {
      friends.unshift({
        id: row.id,
        name: row.name,
        handle: row.handle,
        profilePictureUrl: row.profile_picture_url ?? null,
        bio: row.bio ?? null,
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        lastUpdated: toIsoString(row.updated_at),
        previousLatitude:
          row.previous_latitude != null ? Number(row.previous_latitude) : null,
        previousLongitude:
          row.previous_longitude != null ? Number(row.previous_longitude) : null,
      });
    }
  }

  return friends;
};
