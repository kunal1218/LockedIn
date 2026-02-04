import { Router } from "express";
import {
  postPokerBuyIn,
  getPokerSession,
  postPokerStartHand,
  postPokerAction,
} from "../controllers/pokerController";

const router = Router();

router.post("/buy-in", postPokerBuyIn);
router.get("/state", getPokerSession);
router.post("/start-hand", postPokerStartHand);
router.post("/action", postPokerAction);

export default router;
