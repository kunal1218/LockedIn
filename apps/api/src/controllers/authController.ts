import type { Request, Response } from "express";
import {
  AuthError,
  getUserFromToken,
  requestPasswordReset,
  resetPasswordWithToken,
  signInUser,
  signUpUser,
} from "../services/authService";

const asString = (value: unknown) => (typeof value === "string" ? value : "");

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

const handleError = (res: Response, error: unknown) => {
  if (error instanceof AuthError) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  console.error("Auth error:", error);
  res.status(500).json({ error: "Authentication failed" });
};

export const signUp = async (req: Request, res: Response) => {
  try {
    const payload = await signUpUser({
      name: asString(req.body?.name),
      email: asString(req.body?.email),
      password: asString(req.body?.password),
      handle: asString(req.body?.handle) || undefined,
    });
    res.status(201).json(payload);
  } catch (error) {
    handleError(res, error);
  }
};

export const signIn = async (req: Request, res: Response) => {
  try {
    const payload = await signInUser({
      email: asString(req.body?.email),
      password: asString(req.body?.password),
    });
    res.json(payload);
  } catch (error) {
    handleError(res, error);
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    await requestPasswordReset(asString(req.body?.email));
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    await resetPasswordWithToken({
      token: asString(req.body?.token),
      password: asString(req.body?.password),
    });
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
};

export const me = async (req: Request, res: Response) => {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: "Missing session token" });
    return;
  }

  try {
    const user = await getUserFromToken(token);
    if (!user) {
      res.status(401).json({ error: "Invalid session" });
      return;
    }

    res.json({ user });
  } catch (error) {
    handleError(res, error);
  }
};
