import type { Request, Response } from "express";
import { fetchProfile, fetchPublicProfileByHandle } from "../services/profileService";

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
    const profile = await fetchPublicProfileByHandle(handle);
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
