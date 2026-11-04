const ticketController = require("../controllers/ticketController");
const ticketModel = require("../models/ticketModel");
const ticketHistoryModel = require("../models/ticketHistoryModel");
const fs = require("fs/promises");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/ticketModel");
jest.mock("../models/ticketHistoryModel");
jest.mock("fs/promises");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  ticketModel.TERMINAL_STATUSES = ["Completed", "Unresolvable"];
});

afterEach(() => {
  console.error.mockRestore();
});

describe("ticketController.getCentres", () => {
  it("should return every hawker centre", async () => {
    const centres = [{ HawkerId: 1, Name: "Maxwell Food Centre" }];
    ticketModel.getHawkerCentres.mockResolvedValue(centres);

    const req = mockRequest();
    const res = mockResponse();

    await ticketController.getCentres(req, res);

    expect(res.json).toHaveBeenCalledWith(centres);
  });

  it("should respond 500 when the lookup fails", async () => {
    ticketModel.getHawkerCentres.mockRejectedValue(new Error("Database error"));

    const req = mockRequest();
    const res = mockResponse();

    await ticketController.getCentres(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch hawker centres" });
  });
});

describe("ticketController.getMyAssignedCentres", () => {
  it("should return the operator's assigned centres", async () => {
    const centres = [{ HawkerId: 1, Name: "Maxwell Food Centre" }];
    ticketModel.getAssignedHawkerCentres.mockResolvedValue(centres);

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await ticketController.getMyAssignedCentres(req, res);

    expect(ticketModel.getAssignedHawkerCentres).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith(centres);
  });

  it("should respond 500 when the lookup fails", async () => {
    ticketModel.getAssignedHawkerCentres.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await ticketController.getMyAssignedCentres(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ticketController.createTicket", () => {
  it("should create a ticket without attachments", async () => {
    ticketModel.createTicket.mockResolvedValue(41);

    const req = mockRequest({
      user: { id: 7, role: "customer" },
      body: { HawkerId: 1, Category: "Cleanliness", Subject: "Spill", Description: "Wet floor" }
    });
    const res = mockResponse();

    await ticketController.createTicket(req, res);

    expect(ticketModel.createTicket).toHaveBeenCalledWith({
      HawkerId: 1,
      UserId: 7,
      UserRole: "customer",
      Category: "Cleanliness",
      OtherCategoryText: undefined,
      Subject: "Spill",
      Description: "Wet floor"
    });
    expect(ticketModel.addAttachments).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "Ticket submitted", TicketId: 41 });
  });

  it("should store uploaded attachments alongside the ticket", async () => {
    ticketModel.createTicket.mockResolvedValue(41);
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);

    const req = mockRequest({
      user: { id: 7, role: "customer" },
      body: { HawkerId: 1, Category: "Cleanliness", Subject: "Spill", Description: "Wet floor" },
      files: [{ originalname: "photo.png", mimetype: "image/png", size: 1024, buffer: Buffer.from("x") }]
    });
    const res = mockResponse();

    await ticketController.createTicket(req, res);

    expect(fs.writeFile).toHaveBeenCalledTimes(1);
    expect(ticketModel.addAttachments).toHaveBeenCalledWith(41, [
      expect.objectContaining({ fileName: "photo.png", fileType: "image/png", fileSizeBytes: 1024 })
    ]);
  });

  it("should respond 400 when an image is over 5MB", async () => {
    const req = mockRequest({
      user: { id: 7, role: "customer" },
      body: {},
      files: [{ originalname: "big.png", mimetype: "image/png", size: 6 * 1024 * 1024 }]
    });
    const res = mockResponse();

    await ticketController.createTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toContain("big.png is too large");
    expect(ticketModel.createTicket).not.toHaveBeenCalled();
  });

  it("should respond 400 when a video is over 50MB", async () => {
    const req = mockRequest({
      user: { id: 7, role: "customer" },
      body: {},
      files: [{ originalname: "clip.mp4", mimetype: "video/mp4", size: 51 * 1024 * 1024 }]
    });
    const res = mockResponse();

    await ticketController.createTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(ticketModel.createTicket).not.toHaveBeenCalled();
  });

  it("should respond 500 when the insert fails", async () => {
    ticketModel.createTicket.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 7, role: "customer" }, body: {} });
    const res = mockResponse();

    await ticketController.createTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to submit ticket" });
  });
});

describe("ticketController.getTickets", () => {
  it("should return a submitter's own open tickets", async () => {
    const tickets = [{ TicketId: 41, Status: "Open" }];
    ticketModel.getTicketsForSubmitter.mockResolvedValue(tickets);

    const req = mockRequest({ user: { id: 7, role: "customer" }, query: {} });
    const res = mockResponse();

    await ticketController.getTickets(req, res);

    expect(ticketModel.getTicketsForSubmitter).toHaveBeenCalledWith(7, "open");
    expect(res.json).toHaveBeenCalledWith(tickets);
  });

  it("should attach the closing history to a submitter's closed tickets", async () => {
    ticketModel.getTicketsForSubmitter.mockResolvedValue([{ TicketId: 41 }, { TicketId: 42 }]);
    ticketHistoryModel.getHistoryForSubmitter.mockResolvedValue([{ TicketId: 41, Message: "Cleaned up" }]);

    const req = mockRequest({ user: { id: 7, role: "customer" }, query: { status: "closed" } });
    const res = mockResponse();

    await ticketController.getTickets(req, res);

    const sent = res.json.mock.calls[0][0];
    expect(sent[0].history).toEqual({ TicketId: 41, Message: "Cleaned up" });
    expect(sent[1].history).toBeNull();
  });

  it("should return the operator's assigned-centre tickets with filters", async () => {
    ticketModel.getAssignedHawkerIds.mockResolvedValue([1, 2]);
    ticketModel.getTicketsForOperator.mockResolvedValue([]);

    const req = mockRequest({
      user: { id: 2, role: "operator" },
      query: { category: "Cleanliness", hawkerId: "1", exactStatus: "Testing" }
    });
    const res = mockResponse();

    await ticketController.getTickets(req, res);

    expect(ticketModel.getTicketsForOperator).toHaveBeenCalledWith({
      hawkerIds: [1, 2],
      statusGroup: "open",
      category: "Cleanliness",
      hawkerId: 1,
      status: "Testing"
    });
  });

  it("should respond 403 for any other role", async () => {
    const req = mockRequest({ user: { id: 3, role: "nea" }, query: {} });
    const res = mockResponse();

    await ticketController.getTickets(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Only customers, vendors, or operators can view tickets"
    });
  });

  it("should respond 500 when the lookup fails", async () => {
    ticketModel.getTicketsForSubmitter.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 7, role: "customer" }, query: {} });
    const res = mockResponse();

    await ticketController.getTickets(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ticketController.getOperatorHistory", () => {
  it("should return the operator's closed ticket history", async () => {
    ticketModel.getAssignedHawkerIds.mockResolvedValue([1]);
    ticketHistoryModel.getHistoryForOperator.mockResolvedValue([{ TicketHistoryId: 3 }]);

    const req = mockRequest({
      user: { id: 2 },
      query: { category: "Cleanliness", outcome: "Completed", dateFrom: "2026-01-01", dateTo: "2026-02-01" }
    });
    const res = mockResponse();

    await ticketController.getOperatorHistory(req, res);

    expect(ticketHistoryModel.getHistoryForOperator).toHaveBeenCalledWith({
      hawkerIds: [1],
      category: "Cleanliness",
      outcome: "Completed",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01"
    });
    expect(res.json).toHaveBeenCalledWith([{ TicketHistoryId: 3 }]);
  });

  it("should respond 500 when the lookup fails", async () => {
    ticketModel.getAssignedHawkerIds.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 2 }, query: {} });
    const res = mockResponse();

    await ticketController.getOperatorHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ticketController.getTicketById", () => {
  it("should return a submitter's own ticket with its attachments", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41, UserId: 7, HawkerId: 1, Status: "Open" });
    ticketModel.getAttachmentsByTicketId.mockResolvedValue([{ FileName: "photo.png" }]);

    const req = mockRequest({ params: { id: "41" }, user: { id: 7, role: "customer" } });
    const res = mockResponse();

    await ticketController.getTicketById(req, res);

    expect(res.json.mock.calls[0][0].attachments).toEqual([{ FileName: "photo.png" }]);
    expect(ticketHistoryModel.getLatestHistoryForTicket).not.toHaveBeenCalled();
  });

  it("should attach the closing history for a terminal ticket", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41, UserId: 7, HawkerId: 1, Status: "Completed" });
    ticketModel.getAttachmentsByTicketId.mockResolvedValue([]);
    ticketHistoryModel.getLatestHistoryForTicket.mockResolvedValue({ Message: "Cleaned up" });

    const req = mockRequest({ params: { id: "41" }, user: { id: 7, role: "customer" } });
    const res = mockResponse();

    await ticketController.getTicketById(req, res);

    expect(res.json.mock.calls[0][0].history).toEqual({ Message: "Cleaned up" });
  });

  it("should respond 404 when the ticket does not exist", async () => {
    ticketModel.getTicketById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" }, user: { id: 7, role: "customer" } });
    const res = mockResponse();

    await ticketController.getTicketById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Ticket not found" });
  });

  it("should respond 403 for another submitter's ticket", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41, UserId: 99, HawkerId: 1, Status: "Open" });

    const req = mockRequest({ params: { id: "41" }, user: { id: 7, role: "customer" } });
    const res = mockResponse();

    await ticketController.getTicketById(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "You can only view your own tickets" });
  });

  it("should respond 403 for an operator not assigned to that centre", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41, UserId: 7, HawkerId: 1, Status: "Open" });
    ticketModel.isOperatorAssignedToHawker.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "41" }, user: { id: 2, role: "operator" } });
    const res = mockResponse();

    await ticketController.getTicketById(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("should respond 500 when the lookup fails", async () => {
    ticketModel.getTicketById.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "41" }, user: { id: 7, role: "customer" } });
    const res = mockResponse();

    await ticketController.getTicketById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ticketController.claimTicket", () => {
  it("should let an assigned operator claim an open ticket", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41, HawkerId: 1 });
    ticketModel.isOperatorAssignedToHawker.mockResolvedValue(true);
    ticketModel.claimTicket.mockResolvedValue(true);

    const req = mockRequest({ params: { id: "41" }, user: { id: 2, role: "operator" } });
    const res = mockResponse();

    await ticketController.claimTicket(req, res);

    expect(ticketModel.claimTicket).toHaveBeenCalledWith(41, 2);
    expect(res.json).toHaveBeenCalledWith({ message: "Ticket claimed" });
  });

  it("should respond 404 when the ticket does not exist", async () => {
    ticketModel.getTicketById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" }, user: { id: 2, role: "operator" } });
    const res = mockResponse();

    await ticketController.claimTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should respond 403 when the operator is not assigned to that centre", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41, HawkerId: 1 });
    ticketModel.isOperatorAssignedToHawker.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "41" }, user: { id: 2, role: "operator" } });
    const res = mockResponse();

    await ticketController.claimTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ticketModel.claimTicket).not.toHaveBeenCalled();
  });

  it("should respond 409 when the ticket was already claimed", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41, HawkerId: 1 });
    ticketModel.isOperatorAssignedToHawker.mockResolvedValue(true);
    ticketModel.claimTicket.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "41" }, user: { id: 2, role: "operator" } });
    const res = mockResponse();

    await ticketController.claimTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Ticket has already been claimed" });
  });
});

describe("ticketController.updateTicketStatus", () => {
  it("should update the status for the assigned operator", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41 });
    ticketModel.updateStatus.mockResolvedValue(true);

    const req = mockRequest({
      params: { id: "41" },
      user: { id: 2, role: "operator" },
      body: { Status: "Testing" }
    });
    const res = mockResponse();

    await ticketController.updateTicketStatus(req, res);

    expect(ticketModel.updateStatus).toHaveBeenCalledWith(41, 2, "Testing");
    expect(res.json).toHaveBeenCalledWith({ message: "Ticket status updated", Status: "Testing" });
  });

  it("should respond 404 when the ticket does not exist", async () => {
    ticketModel.getTicketById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" }, user: { id: 2 }, body: { Status: "Testing" } });
    const res = mockResponse();

    await ticketController.updateTicketStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should respond 403 when another operator owns the ticket", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41 });
    ticketModel.updateStatus.mockResolvedValue(false);

    const req = mockRequest({ params: { id: "41" }, user: { id: 2 }, body: { Status: "Testing" } });
    const res = mockResponse();

    await ticketController.updateTicketStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("ticketController.completeTicket", () => {
  it("should write a history row and close the ticket", async () => {
    ticketModel.getTicketById.mockResolvedValue({
      TicketId: 41,
      UserId: 7,
      UserRole: "customer",
      Category: "Cleanliness",
      Description: "Wet floor",
      AssignedOperatorId: 2
    });

    const req = mockRequest({
      params: { id: "41" },
      user: { id: 2, role: "operator" },
      body: { Message: "Cleaned up", Outcome: "Completed" }
    });
    const res = mockResponse();

    await ticketController.completeTicket(req, res);

    expect(ticketHistoryModel.insertHistory).toHaveBeenCalledWith({
      TicketId: 41,
      UserId: 7,
      UserRole: "customer",
      Category: "Cleanliness",
      TicketDescription: "Wet floor",
      Message: "Cleaned up",
      Status: "Completed",
      ResolvedByUserId: 2
    });
    expect(ticketModel.closeTicket).toHaveBeenCalledWith(41, "Completed");
    expect(res.json).toHaveBeenCalledWith({ message: "Ticket marked as Completed", Status: "Completed" });
  });

  it("should respond 404 when the ticket does not exist", async () => {
    ticketModel.getTicketById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" }, user: { id: 2 }, body: {} });
    const res = mockResponse();

    await ticketController.completeTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("should respond 403 when the caller is not the assigned operator", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41, AssignedOperatorId: 99 });

    const req = mockRequest({ params: { id: "41" }, user: { id: 2 }, body: { Outcome: "Completed" } });
    const res = mockResponse();

    await ticketController.completeTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(ticketModel.closeTicket).not.toHaveBeenCalled();
  });

  it("should respond 500 when closing fails", async () => {
    ticketModel.getTicketById.mockResolvedValue({ TicketId: 41, AssignedOperatorId: 2 });
    ticketHistoryModel.insertHistory.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "41" }, user: { id: 2 }, body: { Outcome: "Completed" } });
    const res = mockResponse();

    await ticketController.completeTicket(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to close ticket" });
  });
});
