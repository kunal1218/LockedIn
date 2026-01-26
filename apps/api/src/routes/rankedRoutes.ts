import { Router } from "express";
import {
  getRankedStatus,
  getRankedMessages,
  postRankedCancel,
  postRankedMessage,
  postRankedPlay,
  postRankedSave,
  postRankedTimeout,
} from "../controllers/rankedController";

const router = Router();

router.post("/play", postRankedPlay);
router.get("/status", getRankedStatus);
router.post("/cancel", postRankedCancel);
router.get("/match/:matchId/messages", getRankedMessages);
router.post("/match/:matchId/messages", postRankedMessage);
router.post("/match/:matchId/save", postRankedSave);
router.post("/match/:matchId/timeout", postRankedTimeout);

export default router;
