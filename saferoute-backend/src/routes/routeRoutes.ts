import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  getAllRoutes, getRouteById, createRoute, updateRoute, deleteRoute,
  getStopsByRoute, createStop, updateStop, deleteStop
} from "../controllers/routeController";

const router = Router();

router.use(authenticate);

// Routes
router.get("/",        getAllRoutes);
router.get("/:id",     getRouteById);
router.post("/",       authorize("admin"), createRoute);
router.put("/:id",     authorize("admin"), updateRoute);
router.delete("/:id",  authorize("admin"), deleteRoute);

// Stops (nested under routes)
router.get("/:routeId/stops",   getStopsByRoute);
router.post("/stops",           authorize("admin"), createStop);
router.put("/stops/:id",        authorize("admin"), updateStop);
router.delete("/stops/:id",     authorize("admin"), deleteStop);

export default router;
