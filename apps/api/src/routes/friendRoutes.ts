import { Router } from "express";
import {
  acceptFriend,
  blockFriend,
  getFriendSummary,
  getRelationship,
  removeFriend,
  removePendingFriend,
  requestFriend,
  unblockFriend,
} from "../controllers/friendController";

const router = Router();

router.get("/summary", getFriendSummary);
router.get("/relationship/:handle", getRelationship);
router.post("/requests", requestFriend);
router.post("/requests/accept/:handle", acceptFriend);
router.delete("/requests/with/:handle", removePendingFriend);
router.delete("/:handle", removeFriend);
router.post("/block/:handle", blockFriend);
router.delete("/block/:handle", unblockFriend);

export default router;
