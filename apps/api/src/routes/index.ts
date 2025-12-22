import type { Express } from "express";
import challengeRoutes from "./challengeRoutes";
import chatRoutes from "./chatRoutes";
import authRoutes from "./authRoutes";
import eventsRoutes from "./eventsRoutes";
import feedRoutes from "./feedRoutes";
import profileRoutes from "./profileRoutes";
import requestsRoutes from "./requestsRoutes";

export const registerRoutes = (app: Express) => {
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/auth", authRoutes);
  app.use("/challenge", challengeRoutes);
  app.use("/chat", chatRoutes);
  app.use("/events", eventsRoutes);
  app.use("/feed", feedRoutes);
  app.use("/requests", requestsRoutes);
  app.use("/profile", profileRoutes);
};
