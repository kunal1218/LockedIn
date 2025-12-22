import { createClient } from "redis";

let client: ReturnType<typeof createClient> | null = null;

export const getRedis = async () => {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!client) {
    client = createClient({ url: process.env.REDIS_URL });
    client.on("error", (error) => {
      console.error("Redis error:", error);
    });
    await client.connect();
  }

  return client;
};
