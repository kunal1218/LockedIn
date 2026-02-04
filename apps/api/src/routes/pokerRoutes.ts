import { Router } from "express";
import {
  postPokerQueue,
  getPokerState,
  postPokerAction,
  postPokerRebuy,
  postPokerLeave,
} from "../controllers/pokerController";

const router = Router();

router.post("/queue", postPokerQueue);
router.get("/state", getPokerState);
router.post("/action", postPokerAction);
router.post("/rebuy", postPokerRebuy);
router.post("/leave", postPokerLeave);

export default router;
