import { Router } from "express";
import {
  getClubs,
  postClub,
  postClubApplicationDecision,
  postClubJoin,
  postClubLeave,
} from "../controllers/clubsController";

const router = Router();

router.get("/", getClubs);
router.post("/", postClub);
router.post("/:clubId/join", postClubJoin);
router.post("/:clubId/leave", postClubLeave);
router.post(
  "/:clubId/applications/:applicantId/:decision",
  postClubApplicationDecision
);

export default router;
