const Notification = require("../models/notificationModel");
const Stall = require("../models/stallModel");
const sql = require("mssql");
const { mockTaggedQuery, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");
jest.mock("../models/stallModel");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("notificationModel.createNotification", () => {
  it("should insert a notification that does not exist yet", async () => {
    mockTaggedQuery([rows([]), affected(1)]);

    await expect(
      Notification.createNotification(5, "order", "New order", "Body", "orders.html", "order", 12)
    ).resolves.toBe(true);
    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("should skip an insert when the same notification already exists", async () => {
    mockTaggedQuery(rows([{ notificationId: 1 }]));

    await expect(
      Notification.createNotification(5, "order", "New order", "Body", "orders.html", "order", 12)
    ).resolves.toBe(false);
    expect(sql.query).toHaveBeenCalledTimes(1);
  });
});

describe("notificationModel.getNotificationsForVendor", () => {
  it("should return the vendor's notifications", async () => {
    const notifications = [{ notificationId: 1, title: "New order" }];
    mockTaggedQuery(rows(notifications));

    await expect(Notification.getNotificationsForVendor(5)).resolves.toEqual(notifications);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database Error"));

    await expect(Notification.getNotificationsForVendor(5)).rejects.toThrow("Database Error");
  });
});

describe("notificationModel.getUnreadCount", () => {
  it("should return the unread total", async () => {
    mockTaggedQuery(rows([{ cnt: 4 }]));

    await expect(Notification.getUnreadCount(5)).resolves.toBe(4);
  });
});

describe("notificationModel.deleteNotification", () => {
  it("should return true when the vendor's notification was removed", async () => {
    mockTaggedQuery(affected(1));

    await expect(Notification.deleteNotification(5, 1)).resolves.toBe(true);
  });

  it("should return false when it belongs to another vendor", async () => {
    mockTaggedQuery(affected(0));

    await expect(Notification.deleteNotification(5, 1)).resolves.toBe(false);
  });
});

describe("notificationModel.markAsRead", () => {
  it("should return true when the notification was marked", async () => {
    mockTaggedQuery(affected(1));

    await expect(Notification.markAsRead(5, 1)).resolves.toBe(true);
  });

  it("should return false when nothing matched", async () => {
    mockTaggedQuery(affected(0));

    await expect(Notification.markAsRead(5, 1)).resolves.toBe(false);
  });
});

describe("notificationModel.markAllAsRead", () => {
  it("should clear every unread notification", async () => {
    mockTaggedQuery(affected(3));

    await expect(Notification.markAllAsRead(5)).resolves.toBe(true);
    expect(sql.query).toHaveBeenCalledTimes(1);
  });
});

describe("notificationModel inspection notifications", () => {
  it("should notify the vendor that an inspection was scheduled", async () => {
    mockTaggedQuery([rows([{ vendorId: 5 }]), affected(1)]);

    await Notification.notifyInspectionCreated(6, 15, "2026-09-01");

    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("should stay silent when the stall has no vendor", async () => {
    mockTaggedQuery(rows([]));

    await Notification.notifyInspectionCreated(6, 15, "2026-09-01");

    expect(sql.query).toHaveBeenCalledTimes(1);
  });

  it("should notify the vendor that an inspection moved", async () => {
    mockTaggedQuery([rows([{ vendorId: 5 }]), affected(1)]);

    await Notification.notifyInspectionUpdated(6, 15, "2026-10-01");

    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("should notify the vendor that an inspection was cancelled", async () => {
    mockTaggedQuery([rows([{ vendorId: 5 }]), affected(1)]);

    await Notification.notifyInspectionCancelled(6, "2026-09-01");

    expect(sql.query).toHaveBeenCalledTimes(2);
  });

  it("should describe a completed assessment with its grade and remarks", async () => {
    const query = mockTaggedQuery([rows([{ vendorId: 5 }]), affected(1)]);

    await Notification.notifyAssessmentCompleted(6, 15, "2026-09-01", "A", "All clear", false);

    const insertedValues = query.mock.calls[1];
    expect(insertedValues).toContain("Inspection complete — Grade A");
    expect(insertedValues.join(" ")).toContain("Officer's remarks: All clear");
  });

  it("should flag probation in the message when a major issue was recorded", async () => {
    const query = mockTaggedQuery([rows([{ vendorId: 5 }]), affected(1)]);

    await Notification.notifyAssessmentCompleted(6, 15, "2026-09-01", "C", "Pests found", true);

    expect(query.mock.calls[1].join(" ")).toContain("places the stall on probation");
  });

  it("should word a revised assessment differently", async () => {
    const query = mockTaggedQuery([rows([{ vendorId: 5 }]), affected(1)]);

    await Notification.notifyAssessmentUpdated(6, 15, "2026-09-01", "B", "", false);

    const insertedValues = query.mock.calls[1];
    expect(insertedValues).toContain("Assessment revised — Grade B");
    expect(insertedValues.join(" ")).toContain("assessment was revised and is now");
  });
});

describe("notificationModel.generateNotifications", () => {
  it("should scan every stall the vendor owns", async () => {
    mockTaggedQuery([
      rows([{ stallId: 3, stallName: "Ah Hock" }]),
      rows([]),
      rows([]),
      rows([]),
      rows([]),
      rows([]),
      rows([])
    ]);
    Stall.getMonthlyTarget.mockResolvedValue({ targetId: null, progressPercent: 0 });
    Stall.getStallStock.mockResolvedValue([]);

    await Notification.generateNotifications(5);

    expect(Stall.getMonthlyTarget).toHaveBeenCalledWith(3);
    expect(Stall.getStallStock).toHaveBeenCalledWith(3);
  });

  it("should raise a target-hit notification once the goal is reached", async () => {
    mockTaggedQuery([
      rows([{ stallId: 3, stallName: "Ah Hock" }]),
      rows([]),
      affected(1),
      rows([]),
      rows([]),
      rows([]),
      rows([]),
      rows([]),
      rows([])
    ]);
    Stall.getMonthlyTarget.mockResolvedValue({ targetId: 1, targetType: "revenue", progressPercent: 120 });
    Stall.getStallStock.mockResolvedValue([]);

    await Notification.generateNotifications(5);

    expect(sql.query.mock.calls.some(call => String(call[0]).includes("INSERT INTO Notifications"))).toBe(true);
  });

  it("should do nothing when the vendor has no stalls", async () => {
    mockTaggedQuery(rows([]));

    await Notification.generateNotifications(5);

    expect(Stall.getMonthlyTarget).not.toHaveBeenCalled();
  });
});
