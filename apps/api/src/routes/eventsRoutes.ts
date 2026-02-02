import { Router } from "express";
import {
  deleteEventById,
  getEvent,
  getMine,
  getNearby,
  patchEvent,
  postCheckIn,
  postEvent,
  postRsvp,
} from "../controllers/eventsController";

const router = Router();

router.post("/", postEvent);
router.get("/nearby", getNearby);
router.get("/user/me", getMine);
router.get("/:id", getEvent);
router.post("/:id/rsvp", postRsvp);
router.post("/:id/checkin", postCheckIn);
router.patch("/:id", patchEvent);
router.delete("/:id", deleteEventById);

export default router;
