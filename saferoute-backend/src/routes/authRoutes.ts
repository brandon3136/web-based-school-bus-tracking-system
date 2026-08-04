import { Router } from "express";
import { login, register, getMe, updateProfile, changePassword, logout, resetDatabase } from "../controllers/authController";
import { authenticate, authorize } from "../middleware/auth";

const router = Router();

router.post("/login",       login);
router.post("/register",    register);
router.post("/logout",      logout);
router.get("/me",           authenticate, getMe);
router.put("/me",           authenticate, updateProfile);
router.put("/password",     authenticate, changePassword);
router.post("/reset-db",    authenticate, authorize("admin"), resetDatabase);

export default router;
