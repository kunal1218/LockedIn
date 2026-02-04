import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  PokerError,
  applyPokerAction,
  getPokerStateForUser,
  queuePokerPlayer,
  rebuyPoker,
} from "../services/pokerService";

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

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof PokerError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Poker error:", error);
  res.status(500).json({ error: "Unable to process poker request" });
};

export const postPokerQueue = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const amount = typeof req.body?.amount === "number" ? req.body.amount : Number(req.body?.amount);
    const result = await queuePokerPlayer({
      userId: user.id,
      name: user.name,
      handle: user.handle,
      amount: Number.isFinite(amount) ? amount : undefined,
    });
    res.json({ state: result.state, tableId: result.tableId });
  } catch (error) {
    handleError(res, error);
  }
};

export const getPokerState = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const result = await getPokerStateForUser(user.id);
    res.json({ state: result.state });
  } catch (error) {
    handleError(res, error);
  }
};

export const postPokerAction = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const raw = req.body ?? {};
    const actionType =
      typeof raw.action === "string" ? raw.action.toLowerCase() : "";
    if (!"fold check call bet raise".split(" ").includes(actionType)) {
      throw new PokerError("Invalid poker action.", 400);
    }
    const amount = typeof raw.amount === "number" ? raw.amount : Number(raw.amount);
    const action =
      actionType === "bet" || actionType === "raise"
        ? { action: actionType, amount }
        : { action: actionType };
    const result = await applyPokerAction({ userId: user.id, action });
    res.json({ state: result.state, tableId: result.tableId });
  } catch (error) {
    handleError(res, error);
  }
};

export const postPokerRebuy = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const amount = typeof req.body?.amount === "number" ? req.body.amount : Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new PokerError("Enter a valid rebuy amount.", 400);
    }
    const result = await rebuyPoker({ userId: user.id, amount });
    res.json({ state: result.state, tableId: result.tableId });
  } catch (error) {
    handleError(res, error);
  }
};
