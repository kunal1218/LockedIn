import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  MarketplaceConversationError,
  createOrGetConversation,
  getConversationById,
  getConversations,
  getMessages,
  sendMessage,
} from "../services/marketplaceConversationService";

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

const asString = (value: unknown) => (typeof value === "string" ? value : "");

const parseContent = (value: unknown) => {
  const content = asString(value).trim();
  if (!content) {
    throw new MarketplaceConversationError("Message content is required", 400);
  }
  return content;
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof MarketplaceConversationError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Marketplace conversation error:", error);
  res.status(500).json({ error: "Unable to process marketplace messages" });
};

export const startListingConversation = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const listingId = asString(req.params?.listingId).trim();
    if (!listingId) {
      throw new MarketplaceConversationError("Listing id is required", 400);
    }

    const content = parseContent(req.body?.content ?? req.body?.message ?? req.body?.body);
    const { conversationId } = await createOrGetConversation({
      listingId,
      buyerId: user.id,
    });

    const message = await sendMessage({
      conversationId,
      senderId: user.id,
      content,
    });

    res.status(201).json({ conversationId, message });
  } catch (error) {
    handleError(res, error);
  }
};

export const listMarketplaceConversations = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const conversations = await getConversations(user.id);
    res.json({ conversations });
  } catch (error) {
    handleError(res, error);
  }
};

export const getMarketplaceConversationMessages = async (
  req: Request,
  res: Response
) => {
  try {
    const user = await requireUser(req);
    const conversationId = asString(req.params?.conversationId).trim();
    if (!conversationId) {
      throw new MarketplaceConversationError("Conversation id is required", 400);
    }

    const [conversation, messages] = await Promise.all([
      getConversationById(conversationId, user.id),
      getMessages(conversationId, user.id),
    ]);

    res.json({ conversation, messages });
  } catch (error) {
    handleError(res, error);
  }
};

export const postMarketplaceConversationMessage = async (
  req: Request,
  res: Response
) => {
  try {
    const user = await requireUser(req);
    const conversationId = asString(req.params?.conversationId).trim();
    if (!conversationId) {
      throw new MarketplaceConversationError("Conversation id is required", 400);
    }

    const content = parseContent(req.body?.content ?? req.body?.message ?? req.body?.body);
    const message = await sendMessage({
      conversationId,
      senderId: user.id,
      content,
    });

    res.status(201).json({ message });
  } catch (error) {
    handleError(res, error);
  }
};
