import { ApiError } from "../api/client";

export const formatError = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong.";

export const isAuthError = (error: unknown) =>
  error instanceof ApiError && error.status === 401;
