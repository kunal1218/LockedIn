import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  MapError,
  fetchFriendLocations,
  getMapSettings,
  updateMapSettings,
  upsertUserLocation,
} from "../services/mapService";

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

const asNumber = (value: unknown) =>
  typeof value === "number" ? value : Number(value);

const isValidLatitude = (value: number) =>
  Number.isFinite(value) && value >= -90 && value <= 90;

const isValidLongitude = (value: number) =>
  Number.isFinite(value) && value >= -180 && value <= 180;

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof MapError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Map error:", error);
  res.status(500).json({ error: "Unable to process map request" });
};

export const postLocation = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const latitude = asNumber(req.body?.latitude);
    const longitude = asNumber(req.body?.longitude);

    if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
      throw new MapError("Valid latitude and longitude are required.", 400);
    }

    await upsertUserLocation({
      userId: user.id,
      latitude,
      longitude,
    });

    res.json({ status: "ok" });
  } catch (error) {
    handleError(res, error);
  }
};

export const getFriendLocations = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const [friends, settings] = await Promise.all([
      fetchFriendLocations(user.id),
      getMapSettings(user.id),
    ]);

    res.json({ friends, settings });
  } catch (error) {
    handleError(res, error);
  }
};

export const patchSettings = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const hasShare =
      typeof req.body?.shareLocation === "boolean" ||
      typeof req.body?.ghostMode === "boolean";

    if (!hasShare) {
      throw new MapError("Provide shareLocation or ghostMode to update.", 400);
    }

    const settings = await updateMapSettings(user.id, {
      shareLocation:
        typeof req.body?.shareLocation === "boolean"
          ? req.body.shareLocation
          : undefined,
      ghostMode:
        typeof req.body?.ghostMode === "boolean"
          ? req.body.ghostMode
          : undefined,
    });

    res.json({ settings });
  } catch (error) {
    handleError(res, error);
  }
};
