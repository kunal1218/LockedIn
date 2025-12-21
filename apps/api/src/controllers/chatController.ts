import type { Request, Response } from "express";
import { fetchChatMessages } from "../services/chatService";

export const getChatMessages = async (_req: Request, res: Response) => {
  const messages = await fetchChatMessages();
  res.json(messages);
};
