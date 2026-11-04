const inspectionController = require("../controllers/inspectionController");
const inspectionModel = require("../models/inspectionModel");
const notificationModel = require("../models/notificationModel");
const { baseGrade } = require("../utils/grading");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/inspectionModel");
jest.mock("../models/notificationModel");
jest.mock("../utils/grading");

const STATUS = { SCHEDULED: "Scheduled", IN_PROGRESS: "In Progress", COMPLETED: "Completed" };

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  inspectionModel.STATUS = STATUS;
  baseGrade.mockReturnValue("A");
});

afterEach(() => {
  console.error.mockRestore();
});

describe("inspectionController.createInspection", () => {
  it("should schedule an inspection and notify the vendor", async () => {
    inspectionModel.createInspection.mockResolvedValue(15);

    const req = mockRequest({ user: { userId: 3 }, body: { stallId: 6, date: "2026-09-01" } });
    const res = mockResponse();

    await inspectionController.createInspection(req, res);

    expect(inspectionModel.createInspection).toHaveBeenCalledWith({
      stallId: 6,
      date: "2026-09-01",
      officerId: 3
    });
    expect(notificationModel.notifyInspectionCreated).toHaveBeenCalledWith(6, 15, "2026-09-01");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "Inspection scheduled", id: 15 });
  });

  it("should still succeed when the vendor notification fails", async () => {
    inspectionModel.createInspection.mockResolvedValue(15);
    notificationModel.notifyInspectionCreated.mockRejectedValue(new Error("Notify failed"));

    const req = mockRequest({ user: { userId: 3 }, body: { stallId: 6, date: "2026-09-01" } });
    const res = mockResponse();

    await inspectionController.createInspection(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should respond 409 when the stall already has an open inspection", async () => {
    inspectionModel.createInspection.mockResolvedValue(null);
    inspectionModel.getOpenInspectionByStall.mockResolvedValue({
      inspectionId: 9,
      status: "Scheduled"
    });

    const req = mockRequest({ user: { userId: 3 }, body: { stallId: 6, date: "2026-09-01" } });
    const res = mockResponse();

    await inspectionController.createInspection(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "This stall already has an open inspection (Scheduled).",
      inspectionId: 9,
      status: "Scheduled"
    });
  });

  it("should respond 409 with a generic message when the open inspection cannot be read back", async () => {
    inspectionModel.createInspection.mockResolvedValue(null);
    inspectionModel.getOpenInspectionByStall.mockResolvedValue(null);

    const req = mockRequest({ user: { userId: 3 }, body: { stallId: 6, date: "2026-09-01" } });
    const res = mockResponse();

    await inspectionController.createInspection(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "This stall already has an open inspection." });
  });

  it("should respond 500 when scheduling fails", async () => {
    inspectionModel.createInspection.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { userId: 3 }, body: { stallId: 6, date: "2026-09-01" } });
    const res = mockResponse();

    await inspectionController.createInspection(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Error scheduling inspection" });
  });
});

describe("inspectionController.startWalkInAssessment", () => {
  it("should start a walk-in assessment", async () => {
    inspectionModel.createWalkInInspection.mockResolvedValue(16);

    const req = mockRequest({ params: { stallId: "6" }, user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.startWalkInAssessment(req, res);

    expect(inspectionModel.createWalkInInspection).toHaveBeenCalledWith("6", 3);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "Assessment started", inspectionId: 16 });
  });

  it("should respond 409 when an inspection is already open", async () => {
    inspectionModel.createWalkInInspection.mockResolvedValue(null);
    inspectionModel.getOpenInspectionByStall.mockResolvedValue({ inspectionId: 9, status: "In Progress" });

    const req = mockRequest({ params: { stallId: "6" }, user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.startWalkInAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("should respond 500 when starting fails", async () => {
    inspectionModel.createWalkInInspection.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { stallId: "6" }, user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.startWalkInAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to start the assessment." });
  });
});

describe("inspectionController.getUnassignedStalls", () => {
  it("should list stalls that have never been inspected", async () => {
    inspectionModel.getUnassignedStalls.mockResolvedValue([{ stallId: 6 }]);

    const req = mockRequest();
    const res = mockResponse();

    await inspectionController.getUnassignedStalls(req, res);

    expect(res.json).toHaveBeenCalledWith([{ stallId: 6 }]);
  });

  it("should respond 500 when the lookup fails", async () => {
    inspectionModel.getUnassignedStalls.mockRejectedValue(new Error("Database error"));

    const req = mockRequest();
    const res = mockResponse();

    await inspectionController.getUnassignedStalls(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Error retrieving unassigned stalls" });
  });
});

describe("inspectionController.getStallDetailForOfficer", () => {
  it("should return the stall detail", async () => {
    const detail = { stall: { stallId: 6 }, inspections: [], openInspection: null };
    inspectionModel.getStallDetailForOfficer.mockResolvedValue(detail);

    const req = mockRequest({ params: { stallId: "6" } });
    const res = mockResponse();

    await inspectionController.getStallDetailForOfficer(req, res);

    expect(res.json).toHaveBeenCalledWith(detail);
  });

  it("should respond 404 when the stall does not exist", async () => {
    inspectionModel.getStallDetailForOfficer.mockResolvedValue(null);

    const req = mockRequest({ params: { stallId: "999" } });
    const res = mockResponse();

    await inspectionController.getStallDetailForOfficer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Stall not found" });
  });
});

describe("inspectionController.getAllInspections", () => {
  it("should list the officer's inspections", async () => {
    inspectionModel.getAllInspections.mockResolvedValue([{ inspectionId: 15 }]);

    const req = mockRequest({ query: {}, user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.getAllInspections(req, res);

    expect(inspectionModel.getAllInspections).toHaveBeenCalledWith(3, null);
    expect(res.json).toHaveBeenCalledWith([{ inspectionId: 15 }]);
  });

  it("should apply a valid status filter", async () => {
    inspectionModel.getAllInspections.mockResolvedValue([]);

    const req = mockRequest({ query: { status: "Scheduled" }, user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.getAllInspections(req, res);

    expect(inspectionModel.getAllInspections).toHaveBeenCalledWith(3, "Scheduled");
  });

  it("should respond 400 for an unknown status filter", async () => {
    const req = mockRequest({ query: { status: "Pending" }, user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.getAllInspections(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid status filter." });
    expect(inspectionModel.getAllInspections).not.toHaveBeenCalled();
  });
});

describe("inspectionController.promoteScheduledToInProgress", () => {
  it("should report how many inspections were promoted", async () => {
    inspectionModel.promoteScheduledToInProgress.mockResolvedValue([{ inspectionId: 15 }, { inspectionId: 16 }]);

    const req = mockRequest({ user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.promoteScheduledToInProgress(req, res);

    expect(res.json).toHaveBeenCalledWith({
      count: 2,
      inspections: [{ inspectionId: 15 }, { inspectionId: 16 }]
    });
  });

  it("should respond 500 when promoting fails", async () => {
    inspectionModel.promoteScheduledToInProgress.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.promoteScheduledToInProgress(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("inspectionController.getCompletedInspections", () => {
  it("should list the officer's completed inspections", async () => {
    inspectionModel.getCompletedInspections.mockResolvedValue([{ inspectionId: 15 }]);

    const req = mockRequest({ user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.getCompletedInspections(req, res);

    expect(inspectionModel.getCompletedInspections).toHaveBeenCalledWith(3);
    expect(res.json).toHaveBeenCalledWith([{ inspectionId: 15 }]);
  });

  it("should respond 500 when the lookup fails", async () => {
    inspectionModel.getCompletedInspections.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { userId: 3 } });
    const res = mockResponse();

    await inspectionController.getCompletedInspections(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("inspectionController.getInspectionById", () => {
  it("should return the inspection loaded by the ownership guard", async () => {
    const inspection = { inspectionId: 15, stallId: 6 };

    const req = mockRequest({ inspection });
    const res = mockResponse();

    await inspectionController.getInspectionById(req, res);

    expect(res.json).toHaveBeenCalledWith(inspection);
  });
});

describe("inspectionController.getAllStallsWithGrades", () => {
  it("should list every stall with its grade", async () => {
    inspectionModel.getAllStallsWithGrades.mockResolvedValue([{ stallId: 6, currentGrade: "A" }]);

    const req = mockRequest();
    const res = mockResponse();

    await inspectionController.getAllStallsWithGrades(req, res);

    expect(res.json).toHaveBeenCalledWith([{ stallId: 6, currentGrade: "A" }]);
  });

  it("should respond 500 when the lookup fails", async () => {
    inspectionModel.getAllStallsWithGrades.mockRejectedValue(new Error("Database error"));

    const req = mockRequest();
    const res = mockResponse();

    await inspectionController.getAllStallsWithGrades(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("inspectionController.setStallAutoSchedule", () => {
  it("should turn auto-scheduling on", async () => {
    inspectionModel.setStallAutoSchedule.mockResolvedValue(true);

    const req = mockRequest({ params: { stallId: "6" }, body: { autoSchedule: true } });
    const res = mockResponse();

    await inspectionController.setStallAutoSchedule(req, res);

    expect(inspectionModel.setStallAutoSchedule).toHaveBeenCalledWith("6", true);
    expect(res.json).toHaveBeenCalledWith({ stallId: 6, autoSchedule: true });
  });

  it("should respond 400 when the flag is not a boolean", async () => {
    const req = mockRequest({ params: { stallId: "6" }, body: { autoSchedule: "yes" } });
    const res = mockResponse();

    await inspectionController.setStallAutoSchedule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "autoSchedule must be true or false." });
  });

  it("should respond 404 when the stall does not exist", async () => {
    inspectionModel.setStallAutoSchedule.mockResolvedValue(false);

    const req = mockRequest({ params: { stallId: "999" }, body: { autoSchedule: false } });
    const res = mockResponse();

    await inspectionController.setStallAutoSchedule(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Stall not found" });
  });
});

describe("inspectionController.getGradeHistoryWithDates", () => {
  it("should return the stall's grade history", async () => {
    inspectionModel.getGradeHistoryWithDates.mockResolvedValue([{ historyId: 1, grade: "A" }]);

    const req = mockRequest({ params: { stallId: "6" } });
    const res = mockResponse();

    await inspectionController.getGradeHistoryWithDates(req, res);

    expect(res.json).toHaveBeenCalledWith([{ historyId: 1, grade: "A" }]);
  });

  it("should respond 500 when the lookup fails", async () => {
    inspectionModel.getGradeHistoryWithDates.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { stallId: "6" } });
    const res = mockResponse();

    await inspectionController.getGradeHistoryWithDates(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("inspectionController.updateInspectionSchedule", () => {
  it("should move the inspection date and notify the vendor", async () => {
    inspectionModel.updateInspectionSchedule.mockResolvedValue(true);

    const req = mockRequest({
      inspection: { inspectionId: 15, stallId: 6, status: STATUS.SCHEDULED },
      inspectionId: 15,
      user: { userId: 3 },
      body: { date: "2026-10-01" }
    });
    const res = mockResponse();

    await inspectionController.updateInspectionSchedule(req, res);

    expect(inspectionModel.updateInspectionSchedule).toHaveBeenCalledWith(15, 3, "2026-10-01");
    expect(notificationModel.notifyInspectionUpdated).toHaveBeenCalledWith(6, 15, "2026-10-01");
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("should refuse to reschedule a completed inspection", async () => {
    const req = mockRequest({
      inspection: { inspectionId: 15, status: STATUS.COMPLETED },
      inspectionId: 15,
      user: { userId: 3 },
      body: { date: "2026-10-01" }
    });
    const res = mockResponse();

    await inspectionController.updateInspectionSchedule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Cannot edit schedule of completed inspection" });
    expect(inspectionModel.updateInspectionSchedule).not.toHaveBeenCalled();
  });

  it("should respond 400 when the update affects no row", async () => {
    inspectionModel.updateInspectionSchedule.mockResolvedValue(false);

    const req = mockRequest({
      inspection: { inspectionId: 15, stallId: 6, status: STATUS.SCHEDULED },
      inspectionId: 15,
      user: { userId: 3 },
      body: { date: "2026-10-01" }
    });
    const res = mockResponse();

    await inspectionController.updateInspectionSchedule(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Inspection schedule could not be updated" });
  });
});

describe("inspectionController.deleteInspection", () => {
  it("should delete an open inspection and notify the vendor", async () => {
    inspectionModel.deleteInspection.mockResolvedValue(true);

    const req = mockRequest({
      inspection: { inspectionId: 15, stallId: 6, status: STATUS.SCHEDULED, inspectionDate: "2026-09-01" },
      inspectionId: 15,
      user: { userId: 3 }
    });
    const res = mockResponse();

    await inspectionController.deleteInspection(req, res);

    expect(inspectionModel.deleteInspection).toHaveBeenCalledWith(15, 3);
    expect(notificationModel.notifyInspectionCancelled).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ message: "Inspection deleted" });
  });

  it("should refuse to delete a completed inspection", async () => {
    const req = mockRequest({
      inspection: { inspectionId: 15, status: STATUS.COMPLETED },
      inspectionId: 15,
      user: { userId: 3 }
    });
    const res = mockResponse();

    await inspectionController.deleteInspection(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Cannot delete completed inspection" });
    expect(inspectionModel.deleteInspection).not.toHaveBeenCalled();
  });

  it("should respond 400 when the delete affects no row", async () => {
    inspectionModel.deleteInspection.mockResolvedValue(false);

    const req = mockRequest({
      inspection: { inspectionId: 15, stallId: 6, status: STATUS.SCHEDULED, inspectionDate: "2026-09-01" },
      inspectionId: 15,
      user: { userId: 3 }
    });
    const res = mockResponse();

    await inspectionController.deleteInspection(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("inspectionController.updateAssessment", () => {
  const assessmentBody = {
    hygieneScore: 5,
    personalHygiene: true,
    foodStorage: true,
    pestControl: true,
    isMajorIssue: false,
    remarks: ""
  };

  function completedInspection() {
    return {
      inspectionId: 15,
      stallId: 6,
      status: STATUS.COMPLETED,
      inspectionDate: "2026-09-01"
    };
  }

  it("should revise the assessment and recalculate the grade", async () => {
    inspectionModel.getLatestCompletedInspectionByStall.mockResolvedValue({ inspectionId: 15, inspectionDate: "2026-09-01" });
    inspectionModel.getStallById.mockResolvedValue({ stallId: 6, currentGrade: "B", performanceStartDate: "2023-01-01" });
    inspectionModel.updateAssessment.mockResolvedValue(true);
    inspectionModel.countMajorIssuesByStall.mockResolvedValue(0);
    inspectionModel.getLatestMajorIssueInspectionByStall.mockResolvedValue(undefined);
    inspectionModel.updateStallPerformance.mockResolvedValue(true);

    const req = mockRequest({
      inspection: completedInspection(),
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.updateAssessment(req, res);

    expect(inspectionModel.updateStallPerformance).toHaveBeenCalledWith(6, expect.objectContaining({ grade: "A" }));
    expect(inspectionModel.logGradeHistory).toHaveBeenCalledWith(6, "A", 15, true);
    expect(res.json).toHaveBeenCalledWith({ success: true, newGrade: "A" });
  });

  it("should put a stall on probation after a major issue", async () => {
    inspectionModel.getLatestCompletedInspectionByStall.mockResolvedValue({ inspectionId: 15, inspectionDate: "2026-09-01" });
    inspectionModel.getStallById.mockResolvedValue({ stallId: 6, currentGrade: "A", performanceStartDate: "2023-01-01" });
    inspectionModel.updateAssessment.mockResolvedValue(true);
    inspectionModel.countMajorIssuesByStall.mockResolvedValue(1);
    inspectionModel.getLatestMajorIssueInspectionByStall.mockResolvedValue({
      inspectionId: 15,
      inspectionDate: "2026-09-01"
    });
    inspectionModel.updateStallPerformance.mockResolvedValue(true);

    const req = mockRequest({
      inspection: completedInspection(),
      inspectionId: 15,
      user: { userId: 3 },
      body: Object.assign({}, assessmentBody, { isMajorIssue: true, remarks: "Pests found" })
    });
    const res = mockResponse();

    await inspectionController.updateAssessment(req, res);

    expect(inspectionModel.updateStallPerformance).toHaveBeenCalledWith(6, expect.objectContaining({
      grade: "C",
      probationInspectionId: 15
    }));
    expect(res.json).toHaveBeenCalledWith({ success: true, newGrade: "C" });
  });

  it("should refuse to edit an inspection that is not completed", async () => {
    const req = mockRequest({
      inspection: { inspectionId: 15, status: STATUS.IN_PROGRESS },
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.updateAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Can only edit assessment of completed inspection" });
  });

  it("should refuse to edit anything but the most recent assessment", async () => {
    inspectionModel.getLatestCompletedInspectionByStall.mockResolvedValue({ inspectionId: 20 });

    const req = mockRequest({
      inspection: completedInspection(),
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.updateAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Can only edit the most recent inspection's assessment" });
  });

  it("should respond 400 when the update affects no row", async () => {
    inspectionModel.getLatestCompletedInspectionByStall.mockResolvedValue({ inspectionId: 15 });
    inspectionModel.getStallById.mockResolvedValue({ stallId: 6 });
    inspectionModel.updateAssessment.mockResolvedValue(false);

    const req = mockRequest({
      inspection: completedInspection(),
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.updateAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Assessment could not be updated" });
  });
});

describe("inspectionController.completeAssessment", () => {
  const assessmentBody = {
    hygieneScore: 5,
    personalHygiene: true,
    foodStorage: true,
    pestControl: true,
    isMajorIssue: false,
    remarks: ""
  };

  function inProgressInspection() {
    return {
      inspectionId: 15,
      stallId: 6,
      status: STATUS.IN_PROGRESS,
      inspectionDate: "2026-09-01"
    };
  }

  function stallCleanAfterAssessment() {
    inspectionModel.getStallById.mockResolvedValue({
      stallId: 6,
      currentGrade: "B",
      performanceStartDate: "2023-01-01"
    });
    inspectionModel.completeAssessment.mockResolvedValue(true);
    inspectionModel.getLatestCompletedInspectionByStall.mockResolvedValue({
      inspectionId: 15,
      inspectionDate: "2026-09-01"
    });
    inspectionModel.countMajorIssuesByStall.mockResolvedValue(0);
    inspectionModel.getLatestMajorIssueInspectionByStall.mockResolvedValue(undefined);
    inspectionModel.updateStallPerformance.mockResolvedValue(true);
  }

  it("should complete the assessment and suggest the next date", async () => {
    stallCleanAfterAssessment();
    inspectionModel.getStallAutoSchedule.mockResolvedValue(false);

    const req = mockRequest({
      inspection: inProgressInspection(),
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.completeAssessment(req, res);

    const sent = res.json.mock.calls[0][0];
    expect(sent.message).toBe("Assessment completed");
    expect(sent.newGrade).toBe("A");
    expect(sent.autoScheduled).toBe(false);
    expect(sent.suggestedNextDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(notificationModel.notifyAssessmentCompleted).toHaveBeenCalled();
  });

  it("should book the next inspection when auto-scheduling is on", async () => {
    stallCleanAfterAssessment();
    inspectionModel.getStallAutoSchedule.mockResolvedValue(true);
    inspectionModel.createInspection.mockResolvedValue(21);

    const req = mockRequest({
      inspection: inProgressInspection(),
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.completeAssessment(req, res);

    const sent = res.json.mock.calls[0][0];
    expect(sent.autoScheduled).toBe(true);
    expect(sent.nextInspectionId).toBe(21);
    expect(inspectionModel.createInspection).toHaveBeenCalledWith(
      expect.objectContaining({ stallId: 6, officerId: 3, isAutoScheduled: true })
    );
  });

  it("should fall back to a suggestion when auto-scheduling is blocked", async () => {
    stallCleanAfterAssessment();
    inspectionModel.getStallAutoSchedule.mockResolvedValue(true);
    inspectionModel.createInspection.mockResolvedValue(null);

    const req = mockRequest({
      inspection: inProgressInspection(),
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.completeAssessment(req, res);

    expect(res.json.mock.calls[0][0].autoScheduled).toBe(false);
  });

  it("should refuse an inspection that is not in progress", async () => {
    const req = mockRequest({
      inspection: { inspectionId: 15, status: STATUS.SCHEDULED },
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.completeAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Only In Progress inspections can be assessed" });
  });

  it("should respond 404 when the stall no longer exists", async () => {
    inspectionModel.getStallById.mockResolvedValue(undefined);

    const req = mockRequest({
      inspection: inProgressInspection(),
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.completeAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Stall not found" });
  });

  it("should respond 400 when the assessment affects no row", async () => {
    inspectionModel.getStallById.mockResolvedValue({ stallId: 6 });
    inspectionModel.completeAssessment.mockResolvedValue(false);

    const req = mockRequest({
      inspection: inProgressInspection(),
      inspectionId: 15,
      user: { userId: 3 },
      body: assessmentBody
    });
    const res = mockResponse();

    await inspectionController.completeAssessment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Assessment could not be completed" });
  });
});
