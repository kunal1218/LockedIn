import { db } from "../db";
import { getRedis } from "../db/redis";
import { ensureUsersTable } from "./authService";
import { ensureFriendTables, getRelationshipStatus } from "./friendService";
import { getSocketServer } from "./socketService";

export type MapSettings = {
  shareLocation: boolean;
  ghostMode: boolean;
  publicMode: boolean;
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

export type PublicUserLocation = {
  userId: string;
  name: string;
  handle: string;
  profilePictureUrl?: string | null;
  bio?: string | null;
  collegeName?: string | null;
  collegeDomain?: string | null;
  latitude: number;
  longitude: number;
  mutualFriendsCount?: number | null;
  lastUpdated: string;
};

type MapSettingsRow = {
  share_location: boolean;
  ghost_mode: boolean;
  public_mode?: boolean;
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

const EMIT_DISTANCE_METERS = 10;
const TELEPORT_DISTANCE_METERS = 1000;
const TELEPORT_WINDOW_MS = 10_000;
const PUBLIC_SET_KEY = "locations:public";
const PUBLIC_HASH_KEY = "locations:public:data";
const PUBLIC_VISIBILITY_MAX_MS = 4 * 60 * 60 * 1000;
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
      public_mode boolean NOT NULL DEFAULT false,
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

  await db.query(`
    ALTER TABLE user_locations
    ADD COLUMN IF NOT EXISTS public_mode boolean NOT NULL DEFAULT false;
  `);

  await db.query(`
    CREATE INDEX IF NOT EXISTS user_locations_public_idx
      ON user_locations (share_location, ghost_mode, public_mode);
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
  publicMode: row?.public_mode ?? false,
});

type PublicLocationSnapshot = {
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
};

const prunePublicLocations = async (redis: Awaited<ReturnType<typeof getRedis>>) => {
  if (!redis) {
    return;
  }
  const cutoff = Date.now() - PUBLIC_VISIBILITY_MAX_MS;
  const staleIds = await redis.zRangeByScore(PUBLIC_SET_KEY, 0, cutoff);
  if (staleIds.length > 0) {
    await redis.zRem(PUBLIC_SET_KEY, staleIds);
    await redis.hDel(PUBLIC_HASH_KEY, staleIds);
    try {
      await db.query(
        "UPDATE user_locations SET public_mode = false WHERE user_id = ANY($1::uuid[])",
        [staleIds]
      );
    } catch (error) {
      console.warn("[map] unable to clear stale public mode", error);
    }
  }
};

const savePublicLocation = async (snapshot: PublicLocationSnapshot) => {
  const redis = await getRedis();
  if (!redis) {
    return;
  }
  await redis.zAdd(PUBLIC_SET_KEY, {
    score: snapshot.timestamp,
    value: snapshot.userId,
  });
  await redis.hSet(
    PUBLIC_HASH_KEY,
    snapshot.userId,
    JSON.stringify(snapshot)
  );
};

const removePublicLocation = async (userId: string) => {
  const redis = await getRedis();
  if (!redis) {
    return;
  }
  await redis.zRem(PUBLIC_SET_KEY, userId);
  await redis.hDel(PUBLIC_HASH_KEY, userId);
};

const getPublicSnapshots = async (): Promise<PublicLocationSnapshot[]> => {
  const redis = await getRedis();
  if (!redis) {
    return [];
  }
  await prunePublicLocations(redis);
  const ids = await redis.zRange(PUBLIC_SET_KEY, 0, -1);
  if (ids.length === 0) {
    return [];
  }
  const raw = await redis.hmGet(PUBLIC_HASH_KEY, ids);
  return raw
    .map((value) => {
      if (!value) {
        return null;
      }
      try {
        const parsed = JSON.parse(value) as PublicLocationSnapshot;
        if (!parsed?.userId) {
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    })
    .filter((value): value is PublicLocationSnapshot => Boolean(value));
};

const countMutualFriends = async (userId: string, otherId: string) => {
  const result = await db.query(
    `WITH user_friends AS (
       SELECT CASE WHEN fr.requester_id = $1 THEN fr.recipient_id ELSE fr.requester_id END AS friend_id
       FROM friend_requests fr
       WHERE fr.status = 'accepted'
         AND (fr.requester_id = $1 OR fr.recipient_id = $1)
     ),
     other_friends AS (
       SELECT CASE WHEN fr.requester_id = $2 THEN fr.recipient_id ELSE fr.requester_id END AS friend_id
       FROM friend_requests fr
       WHERE fr.status = 'accepted'
         AND (fr.requester_id = $2 OR fr.recipient_id = $2)
     )
     SELECT COUNT(*)::int AS count
     FROM user_friends uf
     JOIN other_friends ofriends ON uf.friend_id = ofriends.friend_id`,
    [userId, otherId]
  );
  return (result.rows[0] as { count: number })?.count ?? 0;
};

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
  let ghostMode =
    typeof updates.ghostMode === "boolean"
      ? updates.ghostMode
      : current.ghostMode;
  let publicMode =
    typeof updates.publicMode === "boolean"
      ? updates.publicMode
      : current.publicMode;

  if (!shareLocation) {
    publicMode = false;
  }

  if (publicMode) {
    ghostMode = false;
  }

  if (ghostMode) {
    publicMode = false;
  }

  const result = await db.query(
    `INSERT INTO user_locations (user_id, share_location, ghost_mode, public_mode)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id)
     DO UPDATE SET share_location = $2, ghost_mode = $3, public_mode = $4
     RETURNING share_location, ghost_mode, public_mode`,
    [userId, shareLocation, ghostMode, publicMode]
  );

  if (!publicMode) {
    await removePublicLocation(userId);
  }

  return mapSettings(result.rows[0] as MapSettingsRow);
};

export const upsertUserLocation = async (params: {
  userId: string;
  latitude: number;
  longitude: number;
  isPublic?: boolean;
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

  let publicMode =
    typeof params.isPublic === "boolean" ? params.isPublic : settings.publicMode;
  if (settings.ghostMode || !settings.shareLocation) {
    publicMode = false;
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
    `INSERT INTO user_locations (user_id, latitude, longitude, share_location, ghost_mode, public_mode)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id)
     DO UPDATE SET latitude = $2, longitude = $3, share_location = $4, ghost_mode = $5, public_mode = $6, updated_at = now()`,
    [
      params.userId,
      latitude,
      longitude,
      settings.shareLocation,
      settings.ghostMode,
      publicMode,
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

  if (publicMode) {
    await savePublicLocation({
      userId: params.userId,
      latitude,
      longitude,
      timestamp: Date.now(),
    });
  } else {
    await removePublicLocation(params.userId);
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

export const fetchPublicNearby = async (params: {
  userId: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}): Promise<PublicUserLocation[]> => {
  await ensureUsersTable();
  await ensureFriendTables();

  const snapshots = await getPublicSnapshots();
  if (snapshots.length === 0) {
    return [];
  }

  const now = Date.now();
  const filtered = snapshots.filter((snapshot) => {
    if (snapshot.userId === params.userId) {
      return false;
    }
    if (now - snapshot.timestamp > PUBLIC_VISIBILITY_MAX_MS) {
      return false;
    }
    const distance = distanceMeters(
      params.latitude,
      params.longitude,
      snapshot.latitude,
      snapshot.longitude
    );
    return distance <= params.radiusMeters;
  });

  if (filtered.length === 0) {
    return [];
  }

  const candidates: PublicLocationSnapshot[] = [];
  for (const snapshot of filtered) {
    const relation = await getRelationshipStatus(params.userId, snapshot.userId);
    if (relation === "friends" || relation === "blocked" || relation === "blocked_by") {
      continue;
    }
    candidates.push(snapshot);
  }

  if (candidates.length === 0) {
    return [];
  }

  const candidateIds = candidates.map((snapshot) => snapshot.userId);
  const profileResult = await db.query(
    `SELECT id,
            name,
            handle,
            profile_picture_url,
            bio,
            college_name,
            college_domain
     FROM users
     WHERE id = ANY($1::uuid[])`,
    [candidateIds]
  );

  const profileMap = new Map(
    (profileResult.rows as Array<{
      id: string;
      name: string;
      handle: string;
      profile_picture_url?: string | null;
      bio?: string | null;
      college_name?: string | null;
      college_domain?: string | null;
    }>).map((row) => [row.id, row])
  );

  const results: PublicUserLocation[] = [];
  for (const snapshot of candidates) {
    const profile = profileMap.get(snapshot.userId);
    const mutualFriendsCount = await countMutualFriends(params.userId, snapshot.userId);
    results.push({
      userId: snapshot.userId,
      name: profile?.name ?? "Unknown",
      handle: profile?.handle ?? "@unknown",
      profilePictureUrl: profile?.profile_picture_url ?? null,
      bio: profile?.bio ?? null,
      collegeName: profile?.college_name ?? null,
      collegeDomain: profile?.college_domain ?? null,
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
      mutualFriendsCount,
      lastUpdated: new Date(snapshot.timestamp).toISOString(),
    });
  }

  return results;
};
