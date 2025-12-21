import type { Request, Response } from "express";
import { fetchFeed } from "../services/feedService";

export const getFeed = async (_req: Request, res: Response) => {
  const feed = await fetchFeed();
  res.json(feed);
};
