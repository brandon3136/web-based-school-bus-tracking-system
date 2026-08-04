import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { getDrivers, createDriver, deleteDriver } from "../controllers/busController";

const router = Router();

router.use(authenticate);

router.get("/",    authorize("admin"), getDrivers);
router.post("/",   authorize("admin"), createDriver);
router.delete("/:id", authorize("admin"), deleteDriver);

export default router;
