import type { Request, Response } from "express";
import { fetchDailyChallenge } from "../services/challengeService";

export const getDailyChallenge = async (_req: Request, res: Response) => {
  const challenge = await fetchDailyChallenge();
  res.json(challenge);
};
