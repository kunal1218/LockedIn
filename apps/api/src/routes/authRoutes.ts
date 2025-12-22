import { Router } from "express";
import { me, signIn, signUp } from "../controllers/authController";

const router = Router();

router.post("/signup", signUp);
router.post("/login", signIn);
router.get("/me", me);

export default router;
