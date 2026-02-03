import type { Express } from "express";
import adminRoutes from "./adminRoutes";
import challengeRoutes from "./challengeRoutes";
import chatRoutes from "./chatRoutes";
import authRoutes from "./authRoutes";
import eventsRoutes from "./eventsRoutes";
import feedRoutes from "./feedRoutes";
import friendRoutes from "./friendRoutes";
import leaderboardRoutes from "./leaderboardRoutes";
import messageRoutes from "./messageRoutes";
import mapRoutes from "./mapRoutes";
import notificationRoutes from "./notificationRoutes";
import profileRoutes from "./profileRoutes";
import rankedRoutes from "./rankedRoutes";
import requestsRoutes from "./requestsRoutes";

export const registerRoutes = (app: Express) => {
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/admin", adminRoutes);
  app.use("/challenge", challengeRoutes);
  app.use("/chat", chatRoutes);
  app.use("/events", eventsRoutes);
  app.use("/feed", feedRoutes);
  app.use("/friends", friendRoutes);
  app.use("/leaderboard", leaderboardRoutes);
  app.use("/messages", messageRoutes);
  app.use("/map", mapRoutes);
  app.use("/notifications", notificationRoutes);
  app.use("/requests", requestsRoutes);
  app.use("/profile", profileRoutes);
  app.use("/ranked", rankedRoutes);
};
