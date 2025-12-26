const express = require("express");
const router = express.Router();
console.log("Maintenance routes loaded");
const maintenanceController = require("../controllers/maintenanceController");
const { authenticate } = require("../middlewares/auth");

// All routes require authentication
router.use(authenticate);

// POST /maintenance/generate - Generate AI maintenance plan
router.post("/generate", (req, res, next) => {
    console.log("POST /maintenance/generate hit");
    maintenanceController.generatePlan(req, res, next);
});

// GET /maintenance/plan/:userId - Get latest maintenance plan
router.get("/plan/:userId", (req, res, next) => {
    console.log(`GET /maintenance/plan/${req.params.userId} hit`);
    maintenanceController.getPlan(req, res, next);
});

// POST /maintenance/log - Add maintenance log entry
router.post("/log", (req, res, next) => {
    console.log("POST /maintenance/log hit");
    maintenanceController.addLog(req, res, next);
});

// PATCH /maintenance/update-km - Update car mileage
router.patch("/update-km", maintenanceController.updateMileage);

// GET /maintenance/upcoming - Get upcoming maintenance tasks
router.get("/upcoming", maintenanceController.getUpcomingTasks);

// PATCH /maintenance/task/:planId/:taskId/complete - Mark task as completed
router.patch("/task/:planId/:taskId/complete", maintenanceController.completeTask);

module.exports = router;
