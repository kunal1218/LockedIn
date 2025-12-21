import type { Request, Response } from "express";
import { fetchRequests } from "../services/requestsService";

export const getRequests = async (_req: Request, res: Response) => {
  const requests = await fetchRequests();
  res.json(requests);
};
