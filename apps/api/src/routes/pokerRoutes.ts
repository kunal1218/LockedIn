import { Router } from "express";
import {
  postPokerQueue,
  getPokerState,
  postPokerAction,
  postPokerRebuy,
} from "../controllers/pokerController";

const router = Router();

router.post("/queue", postPokerQueue);
router.get("/state", getPokerState);
router.post("/action", postPokerAction);
router.post("/rebuy", postPokerRebuy);

export default router;
