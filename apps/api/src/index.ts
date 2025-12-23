import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { registerRoutes } from "./routes";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json({ limit: "6mb" }));

registerRoutes(app);

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.path} not found` });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4001;

app.listen(port, () => {
  console.log(`LockedIn API listening on ${port}`);
});
