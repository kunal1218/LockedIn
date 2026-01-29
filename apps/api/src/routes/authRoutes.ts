import { Router } from "express";
import {
  forgotPassword,
  me,
  resetPassword,
  signIn,
  signUp,
} from "../controllers/authController";

const router = Router();

router.post("/signup", signUp);
router.post("/login", signIn);
router.post("/forgot", forgotPassword);
router.post("/reset", resetPassword);
router.get("/me", me);

export default router;
