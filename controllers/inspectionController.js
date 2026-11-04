const inspectionModel = require("../models/inspectionModel");
const notificationModel = require("../models/notificationModel");
const { toLocalDateString } = require("../middleware/inspectionValidation");
const { getOfficerId } = require("../middleware/authMiddleware");
const { baseGrade } = require("../utils/grading");

const STATUS = inspectionModel.STATUS;

const RECOVERY_CLEAN_INSPECTIONS = 5;
const RECOVERY_MONTHS = 12;

function handleError(res, err, message) {
    console.error(message, err);
    res.status(500).json({ error: message });
}

async function notifyQuietly(action) {
    try {
        await action();
    } catch (err) {
        console.error("Failed to send vendor notification:", err);
    }
}

async function respondOpenInspectionConflict(res, stallId) {
    const open = await inspectionModel.getOpenInspectionByStall(stallId);
    if (!open) {
        return res.status(409).json({ error: "This stall already has an open inspection." });
    }
    return res.status(409).json({
        error: `This stall already has an open inspection (${open.status}).`,
        inspectionId: open.inspectionId,
        status: open.status
    });
}

async function createInspection(req, res) {
    try {
        const data = { ...req.body, officerId: getOfficerId(req) };
        const id = await inspectionModel.createInspection(data);
        if (id === null) return await respondOpenInspectionConflict(res, data.stallId);

        await notifyQuietly(() =>
            notificationModel.notifyInspectionCreated(data.stallId, id, data.date)
        );
        res.status(201).json({ message: "Inspection scheduled", id });
    } catch (err) {
        handleError(res, err, "Error scheduling inspection");
    }
}

async function startWalkInAssessment(req, res) {
    try {
        const inspectionId = await inspectionModel.createWalkInInspection(
            req.params.stallId, getOfficerId(req)
        );
        if (inspectionId === null) return await respondOpenInspectionConflict(res, req.params.stallId);

        res.status(201).json({ message: "Assessment started", inspectionId });
    } catch (err) {
        handleError(res, err, "Failed to start the assessment.");
    }
}

async function getUnassignedStalls(req, res) {
    try {
        const stalls = await inspectionModel.getUnassignedStalls();
        res.json(stalls);
    } catch (err) {
        handleError(res, err, "Error retrieving unassigned stalls");
    }
}

async function getStallDetailForOfficer(req, res) {
    try {
        const detail = await inspectionModel.getStallDetailForOfficer(req.params.stallId);
        if (!detail) return res.status(404).json({ error: "Stall not found" });
        res.json(detail);
    } catch (err) {
        handleError(res, err, "Error retrieving stall detail");
    }
}

async function getAllInspections(req, res) {
    try {
        const statusFilter = req.query.status || null;
        if (statusFilter && !Object.values(STATUS).includes(statusFilter)) {
            return res.status(400).json({ error: "Invalid status filter." });
        }
        const inspections = await inspectionModel.getAllInspections(getOfficerId(req), statusFilter);
        res.json(inspections);
    } catch (err) {
        handleError(res, err, "Error retrieving inspections");
    }
}

async function promoteScheduledToInProgress(req, res) {
    try {
        const promoted = await inspectionModel.promoteScheduledToInProgress(getOfficerId(req));
        res.json({ count: promoted.length, inspections: promoted });
    } catch (err) {
        handleError(res, err, "Error promoting inspections");
    }
}

async function getCompletedInspections(req, res) {
    try {
        const inspections = await inspectionModel.getCompletedInspections(getOfficerId(req));
        res.json(inspections);
    } catch (err) {
        handleError(res, err, "Error retrieving completed inspections");
    }
}

async function getInspectionById(req, res) {
    res.json(req.inspection);
}

async function getAllStallsWithGrades(req, res) {
    try {
        const stalls = await inspectionModel.getAllStallsWithGrades();
        res.json(stalls);
    } catch (err) {
        handleError(res, err, "Error retrieving stall grades");
    }
}

async function setStallAutoSchedule(req, res) {
    try {
        if (typeof req.body.autoSchedule !== "boolean") {
            return res.status(400).json({ error: "autoSchedule must be true or false." });
        }

        const updated = await inspectionModel.setStallAutoSchedule(
            req.params.stallId,
            req.body.autoSchedule
        );
        if (!updated) return res.status(404).json({ error: "Stall not found" });

        res.json({ stallId: Number(req.params.stallId), autoSchedule: req.body.autoSchedule });
    } catch (err) {
        handleError(res, err, "Error updating auto-schedule");
    }
}

async function getGradeHistoryWithDates(req, res) {
    try {
        const history = await inspectionModel.getGradeHistoryWithDates(req.params.stallId);
        res.json(history);
    } catch (err) {
        handleError(res, err, "Error retrieving grade history");
    }
}

async function updateInspectionSchedule(req, res) {
    try {
        const inspection = req.inspection;
        if (inspection.status === STATUS.COMPLETED) {
            return res.status(400).json({ error: "Cannot edit schedule of completed inspection" });
        }

        const updated = await inspectionModel.updateInspectionSchedule(
            req.inspectionId,
            getOfficerId(req),
            req.body.date
        );

        if (!updated) {
            return res.status(400).json({ error: "Inspection schedule could not be updated" });
        }

        await notifyQuietly(() =>
            notificationModel.notifyInspectionUpdated(
                inspection.stallId,
                req.inspectionId,
                req.body.date
            )
        );

        res.json({ success: true });
    } catch (err) {
        handleError(res, err, "Error updating inspection schedule");
    }
}

function getMonthsDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());

    if (end.getDate() < start.getDate()) {
        months--;
    }
    return months;
}

async function recalculateStallGrade(stallId) {
    const stall = await inspectionModel.getStallById(stallId);
    if (!stall) return;

    const latestInspection = await inspectionModel.getLatestCompletedInspectionByStall(stallId);
    if (!latestInspection) return;

    const totalMajorIssues = await inspectionModel.countMajorIssuesByStall(stallId);
    const latestMajorIssue = await inspectionModel.getLatestMajorIssueInspectionByStall(stallId);

    const clearedPerformance = {
        grade: baseGrade(stall.performanceStartDate, latestInspection.inspectionDate),
        majorIssueCount: totalMajorIssues,
        preIssueGrade: null,
        probationStartDate: null,
        probationInspectionId: null
    };

    let performance;

    if (!latestMajorIssue) {
        performance = clearedPerformance;
    } else {
        const onProbationPerformance = {
            grade: 'C',
            majorIssueCount: totalMajorIssues,
            preIssueGrade: baseGrade(stall.performanceStartDate, latestMajorIssue.inspectionDate),
            probationStartDate: latestMajorIssue.inspectionDate,
            probationInspectionId: latestMajorIssue.inspectionId
        };

        if (latestMajorIssue.inspectionId === latestInspection.inspectionId) {
            performance = onProbationPerformance;
        } else {
            const cleanInspections = await inspectionModel.countCleanInspectionsSince(
                stallId,
                latestMajorIssue.inspectionDate,
                latestMajorIssue.inspectionId
            );
            const cleanMonths = getMonthsDifference(
                latestMajorIssue.inspectionDate,
                latestInspection.inspectionDate
            );
            const recovered = cleanInspections >= RECOVERY_CLEAN_INSPECTIONS
                || cleanMonths >= RECOVERY_MONTHS;

            performance = recovered ? clearedPerformance : onProbationPerformance;
        }
    }

    await inspectionModel.updateStallPerformance(stallId, performance);
    return performance.grade;
}

async function recordGradeHistory(stallId, newGrade, previousGrade, inspectionId, isRevision) {
    await inspectionModel.logGradeHistory(stallId, newGrade, inspectionId, isRevision);
}

async function updateAssessment(req, res) {
    try {
        const inspection = req.inspection;
        if (inspection.status !== STATUS.COMPLETED) {
            return res.status(400).json({ error: "Can only edit assessment of completed inspection" });
        }

        const latestInspection = await inspectionModel.getLatestCompletedInspectionByStall(inspection.stallId);
        if (latestInspection && latestInspection.inspectionId !== inspection.inspectionId) {
            return res.status(400).json({ error: "Can only edit the most recent inspection's assessment" });
        }

        const stallBefore = await inspectionModel.getStallById(inspection.stallId);

        const updated = await inspectionModel.updateAssessment(
            req.inspectionId,
            getOfficerId(req),
            req.body
        );
        if (!updated) return res.status(400).json({ error: "Assessment could not be updated" });

        const newGrade = await recalculateStallGrade(inspection.stallId);
        await recordGradeHistory(
            inspection.stallId,
            newGrade,
            stallBefore?.currentGrade,
            inspection.inspectionId,
            true
        );

        await notifyQuietly(() =>
            notificationModel.notifyAssessmentUpdated(
                inspection.stallId,
                inspection.inspectionId,
                toLocalDateString(new Date(inspection.inspectionDate)),
                newGrade,
                req.body.remarks,
                req.body.isMajorIssue
            )
        );

        res.json({ success: true, newGrade });
    } catch (err) {
        handleError(res, err, "Error updating assessment");
    }
}

async function deleteInspection(req, res) {
    try {
        const inspection = req.inspection;
        if (inspection.status === STATUS.COMPLETED) {
            return res.status(400).json({ error: "Cannot delete completed inspection" });
        }

        const deleted = await inspectionModel.deleteInspection(req.inspectionId, getOfficerId(req));
        if (!deleted) {
            return res.status(400).json({ error: "Inspection could not be deleted" });
        }

        await notifyQuietly(() => {
            const inspectionDate = toLocalDateString(new Date(inspection.inspectionDate));
            return notificationModel.notifyInspectionCancelled(inspection.stallId, inspectionDate);
        });

        res.json({ message: "Inspection deleted" });
    } catch (err) {
        handleError(res, err, "Error deleting inspection");
    }
}

function calculateNextInspectionDate(grade) {
    const now = new Date();
    let monthsToAdd = 2;

    if (grade === 'A') {
        monthsToAdd = 12;
    } else if (grade === 'B') {
        monthsToAdd = 6;
    }

    return toLocalDateString(new Date(now.getFullYear(), now.getMonth() + monthsToAdd, now.getDate()));
}

async function completeAssessment(req, res) {
    try {
        const inspection = req.inspection;
        if (inspection.status !== STATUS.IN_PROGRESS) {
            return res.status(400).json({ error: "Only In Progress inspections can be assessed" });
        }

        const stall = await inspectionModel.getStallById(inspection.stallId);
        if (!stall) return res.status(404).json({ error: "Stall not found" });

        const completed = await inspectionModel.completeAssessment(
            req.inspectionId,
            getOfficerId(req),
            req.body
        );
        if (!completed) return res.status(400).json({ error: "Assessment could not be completed" });

        const newGrade = await recalculateStallGrade(stall.stallId);
        await recordGradeHistory(
            stall.stallId,
            newGrade,
            stall.currentGrade,
            inspection.inspectionId,
            false
        );

        await notifyQuietly(() =>
            notificationModel.notifyAssessmentCompleted(
                inspection.stallId,
                inspection.inspectionId,
                toLocalDateString(new Date(inspection.inspectionDate)),
                newGrade,
                req.body.remarks,
                req.body.isMajorIssue
            )
        );

        const autoSchedule = await inspectionModel.getStallAutoSchedule(stall.stallId);
        const nextInspectionDate = calculateNextInspectionDate(newGrade);

        if (autoSchedule === true) {
            const nextInspectionId = await inspectionModel.createInspection({
                stallId: inspection.stallId,
                officerId: getOfficerId(req),
                date: nextInspectionDate,
                isAutoScheduled: true
            });

            if (nextInspectionId !== null) {
                await notifyQuietly(() =>
                    notificationModel.notifyInspectionCreated(
                        inspection.stallId, nextInspectionId, nextInspectionDate
                    )
                );

                return res.json({
                    message: "Assessment completed and next inspection auto-scheduled",
                    newGrade: newGrade,
                    autoScheduled: true,
                    autoSchedule: autoSchedule,
                    inspectionId: inspection.inspectionId,
                    stallId: stall.stallId,
                    nextInspectionId: nextInspectionId,
                    nextInspectionDate: nextInspectionDate
                });
            }
        }

        res.json({
            message: "Assessment completed",
            newGrade: newGrade,
            autoScheduled: false,
            autoSchedule: autoSchedule,
            inspectionId: inspection.inspectionId,
            stallId: stall.stallId,
            suggestedNextDate: nextInspectionDate
        });
    } catch (err) {
        handleError(res, err, "Error completing assessment");
    }
}

module.exports = {
    createInspection,
    startWalkInAssessment,
    getUnassignedStalls,
    getStallDetailForOfficer,
    getAllInspections,
    promoteScheduledToInProgress,
    getCompletedInspections,
    getInspectionById,
    getAllStallsWithGrades,
    getGradeHistoryWithDates,
    setStallAutoSchedule,
    updateInspectionSchedule,
    updateAssessment,
    deleteInspection,
    completeAssessment
};
