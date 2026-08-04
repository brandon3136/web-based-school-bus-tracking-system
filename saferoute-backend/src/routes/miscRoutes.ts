import { Router } from "express";
import { authenticate, authorize } from "../middleware/auth";
import { getBoardingList, markBoarded, markAlighted, getStudentsForBus } from "../controllers/boardingController";
import { getAllStudents, getMyStudents, getStudentOptions, createStudent, updateStudent, deleteStudent, registerStudentsWithParent } from "../controllers/studentController";
import { sendEmergencyAlert, getAlerts, resolveAlert } from "../controllers/alertController";
import { subscribe, unsubscribe, getVapidPublicKey } from "../controllers/pushController";

const router = Router();

// ── Public Routes (no auth required) ──────────
router.get("/push/vapid-key", getVapidPublicKey);

router.use(authenticate);

// ── Boarding ──────────────────────────────────
router.get( "/boarding/:tripId",         authorize("admin", "driver"), getBoardingList);
router.post("/boarding/boarded",         authorize("driver"),          markBoarded);
router.post("/boarding/alighted",        authorize("driver"),          markAlighted);
router.get( "/buses/:busId/students",    authorize("driver", "admin"), getStudentsForBus);

// ── Students ──────────────────────────────────
router.get( "/students",                 authorize("admin"),           getAllStudents);
router.get( "/students/options",         authorize("admin"),           getStudentOptions);
router.get( "/students/mine",            authorize("parent"),          getMyStudents);
router.post("/students",                 authorize("admin"),           createStudent);
router.post("/students/register",        authorize("admin"),           registerStudentsWithParent);
router.put( "/students/:id",             authorize("admin"),           updateStudent);
router.delete("/students/:id",           authorize("admin"),           deleteStudent);

// ── Emergency Alerts ──────────────────────────
router.post("/alerts/emergency",         authorize("driver"),          sendEmergencyAlert);
router.get( "/alerts",                   authorize("admin"),           getAlerts);
router.patch("/alerts/:id/resolve",      authorize("admin"),           resolveAlert);

// ── Web Push ──────────────────────────────────
router.post("/push/subscribe",           subscribe);
router.post("/push/unsubscribe",         unsubscribe);

export default router;
