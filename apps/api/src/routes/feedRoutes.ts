import { Router } from "express";
import { getFeed } from "../controllers/feedController";

const router = Router();

router.get("/", getFeed);

export default router;
