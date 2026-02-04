import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import http from "http";
import { initializeSocketServer } from "./services/socketService";
import { registerRoutes } from "./routes";

dotenv.config();

const app = express();
const httpServer = http.createServer(app);

app.use(cors());
app.use(express.json({ limit: "6mb" }));

registerRoutes(app);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4001;

initializeSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`LockedIn API listening on ${port}`);
  console.log("Deploy tag: backend-redeploy-2026-02-04");
  console.log("API log: railway-redeploy-2026-02-04");
});
