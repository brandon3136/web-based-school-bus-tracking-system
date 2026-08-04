import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  getAllBuses, getBusById, createBus,
  updateBus, deleteBus, getBusLocation
} from "../controllers/busController";

const router = Router();

router.use(authenticate);

router.get("/",           authorize("admin", "driver", "parent"), getAllBuses);
router.get("/:id",        authorize("admin", "driver", "parent"), getBusById);
router.get("/:id/location", authorize("admin", "driver", "parent"), getBusLocation);
router.post("/",          authorize("admin"), createBus);
router.put("/:id",        authorize("admin"), updateBus);
router.delete("/:id",     authorize("admin"), deleteBus);

export default router;
