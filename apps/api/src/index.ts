import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { initializeSocketServer } from "./services/socketService";
import { registerRoutes } from "./routes";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

const allowedOrigins = (process.env.FRONTEND_URLS ?? process.env.FRONTEND_URL ?? "http://localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "6mb" }));

registerRoutes(app);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4001;

initializeSocketServer(httpServer);

httpServer.listen(port);
