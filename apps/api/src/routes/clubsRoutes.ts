import { Router } from "express";
import {
  getClubs,
  getClub,
  getClubChat,
  postClub,
  postClubChat,
  postClubApplicationDecision,
  postClubJoin,
  postClubLeave,
} from "../controllers/clubsController";

const router = Router();

router.get("/", getClubs);
router.get("/:clubId", getClub);
router.post("/", postClub);
router.post("/:clubId/join", postClubJoin);
router.post("/:clubId/leave", postClubLeave);
router.get("/:clubId/chat", getClubChat);
router.post("/:clubId/chat", postClubChat);
router.post(
  "/:clubId/applications/:applicantId/:decision",
  postClubApplicationDecision
);

export default router;
