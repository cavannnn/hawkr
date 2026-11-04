const notificationController = require("../controllers/notificationController");
const Notification = require("../models/notificationModel");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/notificationModel");

describe("notificationController.getNotifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should generate then return the vendor's notifications and unread count", async () => {
    const notifications = [{ notificationId: 1, title: "Low stock: Rice", isRead: false }];
    Notification.generateNotifications.mockResolvedValue(undefined);
    Notification.getNotificationsForVendor.mockResolvedValue(notifications);
    Notification.getUnreadCount.mockResolvedValue(1);

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await notificationController.getNotifications(req, res);

    expect(Notification.generateNotifications).toHaveBeenCalledWith("5");
    expect(res.json).toHaveBeenCalledWith({ notifications, unreadCount: 1 });
  });

  it("should respond 500 when generating notifications fails", async () => {
    Notification.generateNotifications.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await notificationController.getNotifications(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("notificationController.markRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should mark one notification as read", async () => {
    Notification.markAsRead.mockResolvedValue(true);

    const req = mockRequest({ params: { id: "5", notificationId: "9" } });
    const res = mockResponse();

    await notificationController.markRead(req, res);

    expect(Notification.markAsRead).toHaveBeenCalledWith("5", "9");
    expect(res.json).toHaveBeenCalledWith({ message: "Marked as read." });
  });

  it("should respond 404 when the notification is not the vendor's", async () => {
    Notification.markAsRead.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "5", notificationId: "9" } });
    const res = mockResponse();

    await notificationController.markRead(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Notification not found." });
  });

  it("should respond 500 when the update fails", async () => {
    Notification.markAsRead.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5", notificationId: "9" } });
    const res = mockResponse();

    await notificationController.markRead(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("notificationController.markAllRead", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should mark every notification as read", async () => {
    Notification.markAllAsRead.mockResolvedValue(true);

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await notificationController.markAllRead(req, res);

    expect(Notification.markAllAsRead).toHaveBeenCalledWith("5");
    expect(res.json).toHaveBeenCalledWith({ message: "All notifications marked as read." });
  });

  it("should respond 500 when the update fails", async () => {
    Notification.markAllAsRead.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await notificationController.markAllRead(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("notificationController.deleteNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should remove the notification", async () => {
    Notification.deleteNotification.mockResolvedValue(true);

    const req = mockRequest({ params: { id: "5", notificationId: "9" } });
    const res = mockResponse();

    await notificationController.deleteNotification(req, res);

    expect(Notification.deleteNotification).toHaveBeenCalledWith("5", "9");
    expect(res.json).toHaveBeenCalledWith({ message: "Notification removed." });
  });

  it("should respond 404 when there is nothing to remove", async () => {
    Notification.deleteNotification.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "5", notificationId: "9" } });
    const res = mockResponse();

    await notificationController.deleteNotification(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Notification not found." });
  });

  it("should respond 500 when the delete fails", async () => {
    Notification.deleteNotification.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5", notificationId: "9" } });
    const res = mockResponse();

    await notificationController.deleteNotification(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
