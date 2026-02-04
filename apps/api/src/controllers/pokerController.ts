import type { Request, Response } from "express";
import { AuthError, getUserFromToken } from "../services/authService";
import {
  PokerError,
  buyInToPoker,
  applyPokerAction,
  getPokerState,
  startPokerHand,
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

const parseBuyInAmount = (value: unknown) => {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new PokerError("Enter a valid buy-in amount.", 400);
  }
  if (!Number.isInteger(amount)) {
    throw new PokerError("Buy-in must be a whole number.", 400);
  }
  return amount;
};

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError || error instanceof PokerError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Poker error:", error);
  res.status(500).json({ error: "Unable to process poker request" });
};

export const postPokerBuyIn = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const amount = parseBuyInAmount(req.body?.amount);
    const result = await buyInToPoker({ userId: user.id, amount });
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
};

export const getPokerSession = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const state = await getPokerState(user.id);
    res.json({ state });
  } catch (error) {
    handleError(res, error);
  }
};

export const postPokerStartHand = async (req: Request, res: Response) => {
  try {
    const user = await requireUser(req);
    const state = await startPokerHand(user.id);
    res.json({ state });
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
    if (!["fold", "check", "call", "bet", "raise"].includes(actionType)) {
      throw new PokerError("Invalid poker action.", 400);
    }
    const amount =
      typeof raw.amount === "number" ? raw.amount : Number(raw.amount);
    const action =
      actionType === "bet" || actionType === "raise"
        ? { action: actionType, amount }
        : { action: actionType };
    const state = await applyPokerAction(user.id, action);
    res.json({ state });
  } catch (error) {
    handleError(res, error);
  }
};
