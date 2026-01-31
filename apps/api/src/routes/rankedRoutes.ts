import { Router } from "express";
import {
  getRankedStatus,
  getRankedMessages,
  postRankedCancel,
  postRankedMessage,
  postRankedPlay,
  postRankedSave,
  postRankedTimeout,
  patchRankedMessage,
  patchRankedTyping,
  postRankedTypingTest,
  deleteRankedMessage,
} from "../controllers/rankedController";

const router = Router();

router.post("/play", postRankedPlay);
router.get("/status", getRankedStatus);
router.post("/cancel", postRankedCancel);
router.get("/match/:matchId/messages", getRankedMessages);
router.post("/match/:matchId/messages", postRankedMessage);
router.patch("/match/:matchId/messages/:messageId", patchRankedMessage);
router.delete("/match/:matchId/messages/:messageId", deleteRankedMessage);
router.post("/match/:matchId/save", postRankedSave);
router.post("/match/:matchId/timeout", postRankedTimeout);
router.patch("/match/:matchId/typing", patchRankedTyping);
router.post("/match/:matchId/typing-test", postRankedTypingTest);

export default router;
