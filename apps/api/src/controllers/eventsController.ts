import type { Request, Response } from "express";
import { fetchEvents } from "../services/eventsService";

export const getEvents = async (_req: Request, res: Response) => {
  const events = await fetchEvents();
  res.json(events);
};
