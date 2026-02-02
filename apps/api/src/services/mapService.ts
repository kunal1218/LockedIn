import { db } from "../db";
import { ensureUsersTable } from "./authService";
import { ensureFriendTables } from "./friendService";
import { getSocketServer } from "./socketService";

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
const EMIT_DISTANCE_METERS = 10;
const TELEPORT_DISTANCE_METERS = 1000;
const TELEPORT_WINDOW_MS = 10_000;
const lastEmittedByUser = new Map<
  string,
  { latitude: number; longitude: number; timestamp: number }
>();

const toRad = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) => {
  const earthRadius = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

const isValidCoordinate = (value: number, min: number, max: number) =>
  Number.isFinite(value) && value >= min && value <= max;
let profileColumnsCache:
  | Promise<{ profilePicture: boolean; bio: boolean }>
  | null = null;
let historyTableCache: Promise<boolean> | null = null;

const getProfileColumnAvailability = async () => {
  if (profileColumnsCache) {
    return profileColumnsCache;
  }

  profileColumnsCache = (async () => {
    try {
      const result = await db.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_name = 'users'
           AND column_name IN ('profile_picture_url', 'bio')`
      );
      const columns = new Set(
        (result.rows as Array<{ column_name: string }>).map(
          (row) => row.column_name
        )
      );
      return {
        profilePicture: columns.has("profile_picture_url"),
        bio: columns.has("bio"),
      };
    } catch (error) {
      console.warn("[map] unable to check profile columns", error);
      return { profilePicture: false, bio: false };
    }
  })();

  return profileColumnsCache;
};

const hasHistoryTable = async () => {
  if (historyTableCache) {
    return historyTableCache;
  }

  historyTableCache = (async () => {
    try {
      const result = await db.query(
        `SELECT 1
         FROM information_schema.tables
         WHERE table_name = 'user_location_history'
         LIMIT 1`
      );
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      console.warn("[map] unable to check location history table", error);
      return false;
    }
  })();

  return historyTableCache;
};

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
  try {
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

    historyTableCache = Promise.resolve(true);
  } catch (error) {
    console.warn("[map] unable to ensure history table", error);
    historyTableCache = Promise.resolve(false);
  }
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

  const latitude = Number(params.latitude);
  const longitude = Number(params.longitude);
  if (!isValidCoordinate(latitude, -90, 90) || !isValidCoordinate(longitude, -180, 180)) {
    throw new MapError("Valid latitude and longitude are required.", 400);
  }

  const settings = await getMapSettings(params.userId);
  if (!settings.shareLocation) {
    throw new MapError("Enable location sharing first.", 403);
  }

  const lastEmitted = lastEmittedByUser.get(params.userId);
  if (lastEmitted) {
    const elapsed = Date.now() - lastEmitted.timestamp;
    const distance = distanceMeters(
      lastEmitted.latitude,
      lastEmitted.longitude,
      latitude,
      longitude
    );
    if (distance > TELEPORT_DISTANCE_METERS && elapsed < TELEPORT_WINDOW_MS) {
      throw new MapError("Location update rejected.", 400);
    }
  }

  await db.query(
    `INSERT INTO user_locations (user_id, latitude, longitude, share_location, ghost_mode)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id)
     DO UPDATE SET latitude = $2, longitude = $3, updated_at = now()`,
    [
      params.userId,
      latitude,
      longitude,
      settings.shareLocation,
      settings.ghostMode,
    ]
  );

  if (await hasHistoryTable()) {
    try {
      await db.query(
        `INSERT INTO user_location_history (user_id, latitude, longitude)
         VALUES ($1, $2, $3)`,
        [params.userId, latitude, longitude]
      );
    } catch (error) {
      console.warn("[map] unable to insert history row", error);
    }
  }

  const io = getSocketServer();
  if (!io) {
    return;
  }

  const shouldEmit =
    !lastEmitted ||
    distanceMeters(lastEmitted.latitude, lastEmitted.longitude, latitude, longitude) >=
      EMIT_DISTANCE_METERS;

  if (!shouldEmit) {
    return;
  }

  const timestamp = new Date().toISOString();
  io.to("location-updates").emit("friend-location-update", {
    userId: params.userId,
    latitude,
    longitude,
    timestamp,
  });

  lastEmittedByUser.set(params.userId, {
    latitude,
    longitude,
    timestamp: Date.now(),
  });
};

export const fetchFriendLocations = async (
  userId: string
): Promise<FriendLocation[]> => {
  await ensureLocationTable();
  await ensureFriendTables();

  const profileColumns = await getProfileColumnAvailability();
  const historyAvailable = await hasHistoryTable();
  const profilePictureSelect = profileColumns.profilePicture
    ? "users.profile_picture_url"
    : "NULL::text";
  const bioSelect = profileColumns.bio ? "users.bio" : "NULL::text";
  const previousLatitudeSelect = historyAvailable
    ? "prev.latitude AS previous_latitude"
    : "NULL::double precision AS previous_latitude";
  const previousLongitudeSelect = historyAvailable
    ? "prev.longitude AS previous_longitude"
    : "NULL::double precision AS previous_longitude";
  const historyJoin = historyAvailable
    ? `LEFT JOIN LATERAL (
         SELECT latitude, longitude
         FROM user_location_history history
         WHERE history.user_id = locations.user_id
         ORDER BY history.updated_at DESC
         OFFSET 1
         LIMIT 1
       ) prev ON true`
    : "";

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
            ${profilePictureSelect} AS profile_picture_url,
            ${bioSelect} AS bio,
            locations.latitude,
            locations.longitude,
            locations.updated_at,
            ${previousLatitudeSelect},
            ${previousLongitudeSelect}
     FROM unblocked
     JOIN user_locations locations ON locations.user_id = unblocked.friend_id
     LEFT JOIN users ON users.id = unblocked.friend_id
     ${historyJoin}
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
    name: row.name ?? "Unknown",
    handle: row.handle ?? "@unknown",
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
            ${profilePictureSelect} AS profile_picture_url,
            ${bioSelect} AS bio,
            locations.latitude,
            locations.longitude,
            locations.updated_at,
            ${previousLatitudeSelect},
            ${previousLongitudeSelect}
     FROM user_locations locations
     LEFT JOIN users ON users.id = locations.user_id
     ${historyJoin}
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
        name: row.name ?? "Unknown",
        handle: row.handle ?? "@unknown",
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
