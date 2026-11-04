const inspectionModel = require("../models/inspectionModel");
const sql = require("mssql");
const { mockPool, mockTransaction, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("inspectionModel.STATUS", () => {
  it("should expose the inspection lifecycle statuses", () => {
    expect(inspectionModel.STATUS).toEqual({
      SCHEDULED: "Scheduled",
      IN_PROGRESS: "In Progress",
      COMPLETED: "Completed"
    });
  });
});

describe("inspectionModel.getOpenInspectionByStall", () => {
  it("should return the stall's open inspection", async () => {
    const { request } = mockPool(rows([{ inspectionId: 9, status: "Scheduled" }]));

    const open = await inspectionModel.getOpenInspectionByStall(6);

    expect(request.input).toHaveBeenCalledWith("stallId", sql.Int, 6);
    expect(open).toEqual({ inspectionId: 9, status: "Scheduled" });
  });

  it("should return null when nothing is open", async () => {
    mockPool(rows([]));

    await expect(inspectionModel.getOpenInspectionByStall(6)).resolves.toBeNull();
  });
});

describe("inspectionModel.createInspection", () => {
  it("should return the new inspection id", async () => {
    const { request } = mockPool(rows([{ inspectionId: 15 }]));

    const id = await inspectionModel.createInspection({ stallId: 6, officerId: 3, date: "2026-09-01" });

    expect(request.input).toHaveBeenCalledWith("stallId", sql.Int, 6);
    expect(request.input).toHaveBeenCalledWith("isAutoScheduled", sql.Bit, 0);
    expect(id).toBe(15);
  });

  it("should flag an auto-scheduled inspection", async () => {
    const { request } = mockPool(rows([{ inspectionId: 16 }]));

    await inspectionModel.createInspection({
      stallId: 6,
      officerId: 3,
      date: "2026-09-01",
      isAutoScheduled: true
    });

    expect(request.input).toHaveBeenCalledWith("isAutoScheduled", sql.Bit, 1);
  });

  it("should return null when the stall already has an open inspection", async () => {
    mockPool(rows([{ inspectionId: null }]));

    await expect(
      inspectionModel.createInspection({ stallId: 6, officerId: 3, date: "2026-09-01" })
    ).resolves.toBeNull();
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(
      inspectionModel.createInspection({ stallId: 6, officerId: 3, date: "2026-09-01" })
    ).rejects.toThrow("Database Error");
  });
});

describe("inspectionModel.createWalkInInspection", () => {
  it("should return the new inspection id", async () => {
    mockPool(rows([{ inspectionId: 16 }]));

    await expect(inspectionModel.createWalkInInspection(6, 3)).resolves.toBe(16);
  });

  it("should return null when the stall already has an open inspection", async () => {
    mockPool(rows([{ inspectionId: null }]));

    await expect(inspectionModel.createWalkInInspection(6, 3)).resolves.toBeNull();
  });
});

describe("inspectionModel.getUnassignedStalls", () => {
  it("should list stalls with no inspection on record", async () => {
    const stalls = [{ stallId: 6, stallName: "Ah Hock" }];
    mockPool(rows(stalls));

    await expect(inspectionModel.getUnassignedStalls()).resolves.toEqual(stalls);
  });
});

describe("inspectionModel.getStallDetailForOfficer", () => {
  it("should return the stall, its inspections and the open one", async () => {
    mockPool([
      rows([{ stallId: 6, stallName: "Ah Hock" }]),
      rows([
        { inspectionId: 15, status: "Completed" },
        { inspectionId: 16, status: "Scheduled" }
      ])
    ]);

    const detail = await inspectionModel.getStallDetailForOfficer(6);

    expect(detail.stall.stallId).toBe(6);
    expect(detail.inspections).toHaveLength(2);
    expect(detail.openInspection.inspectionId).toBe(16);
  });

  it("should report a null open inspection when everything is completed", async () => {
    mockPool([
      rows([{ stallId: 6 }]),
      rows([{ inspectionId: 15, status: "Completed" }])
    ]);

    const detail = await inspectionModel.getStallDetailForOfficer(6);

    expect(detail.openInspection).toBeNull();
  });

  it("should return null when the stall does not exist", async () => {
    mockPool(rows([]));

    await expect(inspectionModel.getStallDetailForOfficer(999)).resolves.toBeNull();
  });
});

describe("inspectionModel.getAllInspections", () => {
  it("should exclude completed inspections when no filter is given", async () => {
    const { request } = mockPool(rows([]));

    await inspectionModel.getAllInspections(3);

    expect(request.query.mock.calls[0][0]).toContain("AND i.status <> @completed");
  });

  it("should apply a status filter when one is given", async () => {
    const { request } = mockPool(rows([]));

    await inspectionModel.getAllInspections(3, "Scheduled");

    expect(request.input).toHaveBeenCalledWith("statusFilter", sql.VarChar, "Scheduled");
    expect(request.query.mock.calls[0][0]).toContain("AND i.status = @statusFilter");
  });
});

describe("inspectionModel.promoteScheduledToInProgress", () => {
  it("should return the inspections that were promoted", async () => {
    const promoted = [{ inspectionId: 15 }];
    mockPool(rows(promoted));

    await expect(inspectionModel.promoteScheduledToInProgress(3)).resolves.toEqual(promoted);
  });

  it("should return an empty list when none were due", async () => {
    mockPool(rows([]));

    await expect(inspectionModel.promoteScheduledToInProgress(3)).resolves.toEqual([]);
  });
});

describe("inspectionModel.getCompletedInspections", () => {
  it("should list the officer's completed inspections", async () => {
    const inspections = [{ inspectionId: 15, status: "Completed" }];
    const { request } = mockPool(rows(inspections));

    const result = await inspectionModel.getCompletedInspections(3);

    expect(request.input).toHaveBeenCalledWith("officerId", sql.Int, 3);
    expect(result).toEqual(inspections);
  });
});

describe("inspectionModel.getInspectionById", () => {
  it("should return the inspection with its stall and centre", async () => {
    mockPool(rows([{ inspectionId: 15, stallName: "Ah Hock", centreName: "Maxwell" }]));

    const inspection = await inspectionModel.getInspectionById(15);

    expect(inspection.stallName).toBe("Ah Hock");
  });

  it("should return undefined for an unknown inspection", async () => {
    mockPool(rows([]));

    await expect(inspectionModel.getInspectionById(999)).resolves.toBeUndefined();
  });
});

describe("inspectionModel.updateInspectionSchedule", () => {
  it("should return true when a row was updated", async () => {
    mockPool(rows([{ affectedRows: 1 }]));

    await expect(inspectionModel.updateInspectionSchedule(15, 3, "2026-10-01")).resolves.toBe(true);
  });

  it("should return false when the inspection is not the officer's or is completed", async () => {
    mockPool(rows([{ affectedRows: 0 }]));

    await expect(inspectionModel.updateInspectionSchedule(15, 99, "2026-10-01")).resolves.toBe(false);
  });
});

describe("inspectionModel.updateAssessment", () => {
  it("should return true when the completed assessment was revised", async () => {
    const { request } = mockPool(rows([{ affectedRows: 1 }]));

    const updated = await inspectionModel.updateAssessment(15, 3, {
      hygieneScore: 5,
      remarks: "All clear",
      personalHygiene: true,
      foodStorage: true,
      pestControl: true,
      isMajorIssue: false
    });

    expect(request.input).toHaveBeenCalledWith("isMajorIssue", sql.Bit, 0);
    expect(updated).toBe(true);
  });

  it("should store null remarks when none were given", async () => {
    const { request } = mockPool(rows([{ affectedRows: 1 }]));

    await inspectionModel.updateAssessment(15, 3, { hygieneScore: 5 });

    expect(request.input).toHaveBeenCalledWith("remarks", undefined, null);
  });

  it("should return false when nothing matched", async () => {
    mockPool(rows([{ affectedRows: 0 }]));

    await expect(inspectionModel.updateAssessment(15, 99, { hygieneScore: 5 })).resolves.toBe(false);
  });
});

describe("inspectionModel.completeAssessment", () => {
  it("should return true when an in-progress inspection was completed", async () => {
    mockPool(rows([{ affectedRows: 1 }]));

    await expect(
      inspectionModel.completeAssessment(15, 3, { hygieneScore: 5, isMajorIssue: false })
    ).resolves.toBe(true);
  });

  it("should return false when the inspection was not in progress", async () => {
    mockPool(rows([{ affectedRows: 0 }]));

    await expect(
      inspectionModel.completeAssessment(15, 3, { hygieneScore: 5 })
    ).resolves.toBe(false);
  });
});

describe("inspectionModel.updateStallPerformance", () => {
  it("should write the recalculated grade and probation fields", async () => {
    const { request } = mockPool(rows([{ affectedRows: 1 }]));

    const updated = await inspectionModel.updateStallPerformance(6, {
      grade: "C",
      majorIssueCount: 1,
      preIssueGrade: "A",
      probationStartDate: "2026-09-01",
      probationInspectionId: 15
    });

    expect(request.input).toHaveBeenCalledWith("grade", sql.VarChar, "C");
    expect(updated).toBe(true);
  });

  it("should store nulls when the stall is off probation", async () => {
    const { request } = mockPool(rows([{ affectedRows: 1 }]));

    await inspectionModel.updateStallPerformance(6, { grade: "A", majorIssueCount: 0 });

    expect(request.input).toHaveBeenCalledWith("preIssueGrade", sql.VarChar, null);
    expect(request.input).toHaveBeenCalledWith("probationInspectionId", sql.Int, null);
  });
});

describe("inspectionModel.getStallById", () => {
  it("should return the stall row", async () => {
    mockPool(rows([{ stallId: 6, currentGrade: "A" }]));

    await expect(inspectionModel.getStallById(6)).resolves.toEqual({ stallId: 6, currentGrade: "A" });
  });

  it("should return undefined for an unknown stall", async () => {
    mockPool(rows([]));

    await expect(inspectionModel.getStallById(999)).resolves.toBeUndefined();
  });
});

describe("inspectionModel.getStallAutoSchedule", () => {
  it("should return true when auto-scheduling is on", async () => {
    mockPool(rows([{ autoSchedule: true }]));

    await expect(inspectionModel.getStallAutoSchedule(6)).resolves.toBe(true);
  });

  it("should read the bit form as a boolean", async () => {
    mockPool(rows([{ autoSchedule: 1 }]));

    await expect(inspectionModel.getStallAutoSchedule(6)).resolves.toBe(true);
  });

  it("should return false when auto-scheduling is off", async () => {
    mockPool(rows([{ autoSchedule: 0 }]));

    await expect(inspectionModel.getStallAutoSchedule(6)).resolves.toBe(false);
  });

  it("should return null when the stall has never been set", async () => {
    mockPool(rows([{ autoSchedule: null }]));

    await expect(inspectionModel.getStallAutoSchedule(6)).resolves.toBeNull();
  });

  it("should return null when the stall does not exist", async () => {
    mockPool(rows([]));

    await expect(inspectionModel.getStallAutoSchedule(999)).resolves.toBeNull();
  });
});

describe("inspectionModel.setStallAutoSchedule", () => {
  it("should return true when the stall was updated", async () => {
    const { request } = mockPool(rows([{ affectedRows: 1 }]));

    const updated = await inspectionModel.setStallAutoSchedule(6, true);

    expect(request.input).toHaveBeenCalledWith("enabled", sql.Bit, 1);
    expect(updated).toBe(true);
  });

  it("should return false when the stall does not exist", async () => {
    mockPool(rows([{ affectedRows: 0 }]));

    await expect(inspectionModel.setStallAutoSchedule(999, false)).resolves.toBe(false);
  });
});

describe("inspectionModel history lookups", () => {
  it("should return the latest completed inspection", async () => {
    mockPool(rows([{ inspectionId: 15 }]));

    await expect(inspectionModel.getLatestCompletedInspectionByStall(6)).resolves.toEqual({
      inspectionId: 15
    });
  });

  it("should return the latest major-issue inspection", async () => {
    mockPool(rows([{ inspectionId: 15, isMajorIssue: true }]));

    await expect(inspectionModel.getLatestMajorIssueInspectionByStall(6)).resolves.toEqual({
      inspectionId: 15,
      isMajorIssue: true
    });
  });

  it("should count the stall's major issues", async () => {
    mockPool(rows([{ majorCount: 2 }]));

    await expect(inspectionModel.countMajorIssuesByStall(6)).resolves.toBe(2);
  });

  it("should count the clean inspections since a major issue", async () => {
    const { request } = mockPool(rows([{ cleanCount: 3 }]));

    const count = await inspectionModel.countCleanInspectionsSince(6, "2026-01-01", 15);

    expect(request.input).toHaveBeenCalledWith("sinceInspectionId", sql.Int, 15);
    expect(count).toBe(3);
  });
});

describe("inspectionModel.getAllStallsWithGrades", () => {
  it("should list every stall with its grade", async () => {
    const stalls = [{ stallId: 6, currentGrade: "A" }];
    mockPool(rows(stalls));

    await expect(inspectionModel.getAllStallsWithGrades()).resolves.toEqual(stalls);
  });
});

describe("inspectionModel.getGradeHistoryWithDates", () => {
  it("should return the stall's grade history", async () => {
    const history = [{ historyId: 1, grade: "A" }];
    const { request } = mockPool(rows(history));

    const result = await inspectionModel.getGradeHistoryWithDates(6);

    expect(request.input).toHaveBeenCalledWith("stallId", sql.Int, 6);
    expect(result).toEqual(history);
  });
});

describe("inspectionModel.gradeHistoryExists", () => {
  it("should return true when a row already exists", async () => {
    mockPool(rows([{ rowCountFound: 1 }]));

    await expect(inspectionModel.gradeHistoryExists(15)).resolves.toBe(true);
  });

  it("should return false when none exists", async () => {
    mockPool(rows([{ rowCountFound: 0 }]));

    await expect(inspectionModel.gradeHistoryExists(15)).resolves.toBe(false);
  });
});

describe("inspectionModel.logGradeHistory", () => {
  it("should write the grade against the inspection", async () => {
    const { request } = mockPool(rows([]));

    await inspectionModel.logGradeHistory(6, "A", 15, false);

    expect(request.input).toHaveBeenCalledWith("grade", sql.VarChar, "A");
    expect(request.input).toHaveBeenCalledWith("isRevision", sql.Bit, 0);
  });

  it("should flag a revision", async () => {
    const { request } = mockPool(rows([]));

    await inspectionModel.logGradeHistory(6, "C", 15, true);

    expect(request.input).toHaveBeenCalledWith("isRevision", sql.Bit, 1);
  });
});

describe("inspectionModel.deleteInspection", () => {
  it("should clear notification references then delete inside one transaction", async () => {
    mockPool(rows([]));
    const { transaction, request } = mockTransaction([rows([]), rows([{ affectedRows: 1 }])]);

    await expect(inspectionModel.deleteInspection(15, 3)).resolves.toBe(true);
    expect(request.query).toHaveBeenCalledTimes(2);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
  });

  it("should roll back and return false when nothing was deleted", async () => {
    mockPool(rows([]));
    const { transaction } = mockTransaction([rows([]), rows([{ affectedRows: 0 }])]);

    await expect(inspectionModel.deleteInspection(15, 99)).resolves.toBe(false);
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.commit).not.toHaveBeenCalled();
  });

  it("should roll back and rethrow when the delete fails", async () => {
    mockPool(rows([]));
    const { transaction } = mockTransaction([rows([]), new Error("Delete failed")]);

    await expect(inspectionModel.deleteInspection(15, 3)).rejects.toThrow("Delete failed");
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
  });
});
