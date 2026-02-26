import type { AuthUser } from "../api/actions";

export type SessionProps = {
  token: string;
  user: AuthUser;
  onAuthExpired: () => void;
};
