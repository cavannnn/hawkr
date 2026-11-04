const express = require("express");
const router = express.Router();

const inspectionController = require("../controllers/inspectionController");
const neaHawkerController = require("../controllers/neaHawkerController");
const { verifyToken, requireRole } = require("../middleware/authMiddleware");
const { authorizeInspectionOwner } = require("../middleware/inspectionOwnership");
const {
    validateInspection,
    validateUpdateSchedule,
    validateAssessment,
    validateNumericParam
} = require("../middleware/inspectionValidation");

const officer = [verifyToken, requireRole("nea")];

router.get("/hawker-centres", verifyToken, neaHawkerController.getHawkerCentres);

// Must stay above /stalls/:centreId — a path parameter would otherwise match "unassigned".
router.get("/stalls/unassigned", officer, inspectionController.getUnassignedStalls);

router.get("/stalls/:centreId", verifyToken, validateNumericParam("centreId", "hawker centre id"), neaHawkerController.getStalls);

// Active inspections
router.post("/inspections", officer, validateInspection, inspectionController.createInspection);
router.get("/inspections", officer, inspectionController.getAllInspections);

// Promotion endpoint
router.post("/inspections/promote", officer, inspectionController.promoteScheduledToInProgress);

// Completed inspections — MUST come before /inspections/:id
router.get("/inspections/completed", officer, inspectionController.getCompletedInspections);

// Single inspection and operations
router.get("/inspections/:id", officer, authorizeInspectionOwner, inspectionController.getInspectionById);
router.put("/inspections/:id", officer, authorizeInspectionOwner, validateUpdateSchedule, inspectionController.updateInspectionSchedule);
router.delete("/inspections/:id", officer, authorizeInspectionOwner, inspectionController.deleteInspection);

// Assessment routes
router.put("/inspections/:id/assessment", officer, authorizeInspectionOwner, validateAssessment, inspectionController.updateAssessment);
router.put("/inspections/:id/complete", officer, authorizeInspectionOwner, validateAssessment, inspectionController.completeAssessment);

// Stall routes
router.get("/stalls", verifyToken, inspectionController.getAllStallsWithGrades);
router.get("/stalls/:stallId/grade-history", verifyToken, validateNumericParam("stallId", "stall id"), inspectionController.getGradeHistoryWithDates);

// Officer-only: these return hygiene scores, major-issue flags and an officer's remarks.
router.get("/stalls/:stallId/detail", officer, validateNumericParam("stallId", "stall id"), inspectionController.getStallDetailForOfficer);
router.post("/stalls/:stallId/assess-now", officer, validateNumericParam("stallId", "stall id"), inspectionController.startWalkInAssessment);
router.put("/stalls/:stallId/auto-schedule", officer, validateNumericParam("stallId", "stall id"), inspectionController.setStallAutoSchedule);

module.exports = router;
