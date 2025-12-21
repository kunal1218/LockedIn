import type { Request, Response } from "express";
import { fetchProfile } from "../services/profileService";

export const getProfile = async (_req: Request, res: Response) => {
  const profile = await fetchProfile();
  res.json(profile);
};
