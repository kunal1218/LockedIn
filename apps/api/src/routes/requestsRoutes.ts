import { Router } from "express";
import { getRequests } from "../controllers/requestsController";

const router = Router();

router.get("/", getRequests);

export default router;
