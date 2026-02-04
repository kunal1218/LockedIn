import { db } from "../db";
import { ensureUsersTable } from "./authService";

export class PokerError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const normalizeBuyInAmount = (value: number) => {
  if (!Number.isFinite(value) || value <= 0) {
    throw new PokerError("Enter a valid buy-in amount.", 400);
  }
  if (!Number.isInteger(value)) {
    throw new PokerError("Buy-in must be a whole number.", 400);
  }
  return value;
};

export const buyInToPoker = async (params: {
  userId: string;
  amount: number;
}): Promise<{ coins: number; chips: number }> => {
  await ensureUsersTable();
  const amount = normalizeBuyInAmount(params.amount);

  const result = await db.query(
    `UPDATE users
     SET coins = COALESCE(coins, 0) - $2
     WHERE id = $1
       AND COALESCE(coins, 0) >= $2
     RETURNING coins`,
    [params.userId, amount]
  );

  if ((result.rowCount ?? 0) === 0) {
    throw new PokerError("Not enough coins for that buy-in.", 400);
  }

  const coins = Number(result.rows[0]?.coins ?? 0);
  return { coins, chips: amount };
};
