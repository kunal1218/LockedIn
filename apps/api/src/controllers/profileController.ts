import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  ProfileLayoutError,
  fetchProfileLayout,
  saveProfileLayout,
} from "../services/profileLayoutService";
import {
  fetchProfile,
  fetchPublicProfileByHandle,
} from "../services/profileService";

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

const getOptionalUser = async (req: Request) => {
  const token = getToken(req);
  if (!token) {
    return null;
  }

  try {
    return await getUserFromToken(token);
  } catch (error) {
    if (error instanceof AuthError) {
      return null;
    }
    throw error;
  }
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof ProfileLayoutError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Profile error:", error);
  res.status(500).json({ error: "Unable to process profile request" });
};

export const getProfile = async (_req: Request, res: Response) => {
  const profile = await fetchProfile();
  res.json(profile);
};

export const getPublicProfile = async (req: Request, res: Response) => {
  const handle = typeof req.params?.handle === "string" ? req.params.handle : "";
  if (!handle.trim()) {
    res.status(400).json({ error: "Handle is required" });
    return;
  }

  try {
    const viewer = await getOptionalUser(req);
    const mode =
      typeof req.query?.mode === "string" ? req.query.mode : undefined;
    const profile = await fetchPublicProfileByHandle(
      handle,
      mode === "compact" ? "compact" : "default",
      { includeBanInfo: Boolean(viewer?.isAdmin) }
    );
    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    res.json(profile);
  } catch (error) {
    console.error("Public profile error:", error);
    res.status(500).json({ error: "Unable to fetch profile" });
  }
};

export const getProfileLayout = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const mode =
      typeof req.query?.mode === "string" ? req.query.mode : undefined;
    const layout = await fetchProfileLayout({
      userId: user.id,
      mode: mode === "compact" ? "compact" : "default",
    });
    res.json({ layout });
  } catch (error) {
    handleError(res, error);
  }
};

export const saveProfileLayoutHandler = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const layout = await saveProfileLayout({
      userId: user.id,
      mode: req.body?.mode,
      positions: req.body?.positions,
    });
    res.json({ layout });
  } catch (error) {
    handleError(res, error);
  }
};
