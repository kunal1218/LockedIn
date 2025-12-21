import { Router } from "express";
import { getEvents } from "../controllers/eventsController";

const router = Router();

router.get("/", getEvents);

export default router;
