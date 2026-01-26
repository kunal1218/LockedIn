import { Router } from "express";
import {
  getRankedStatus,
  postRankedCancel,
  postRankedPlay,
} from "../controllers/rankedController";

const router = Router();

router.post("/play", postRankedPlay);
router.get("/status", getRankedStatus);
router.post("/cancel", postRankedCancel);

export default router;
