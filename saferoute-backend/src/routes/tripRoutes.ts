import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import {
  startTrip, endTrip, logGps,
  getTripHistory, getTripGpsLogs, getActiveTrips, getParentTripHistory
} from "../controllers/tripController";

const router = Router();

router.use(authenticate);

router.get("/active",          authorize("admin", "parent", "driver"), getActiveTrips);
router.get("/history",         authorize("admin", "driver"), getTripHistory);
router.get("/mine",            authorize("parent"), getParentTripHistory);
router.get("/:tripId/gps",     authorize("admin"),           getTripGpsLogs);
router.post("/start",          authorize("driver"),          startTrip);
router.post("/end",            authorize("driver"),          endTrip);
router.post("/gps",            authorize("driver"),          logGps);

export default router;
