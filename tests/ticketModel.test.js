const ticketModel = require("../models/ticketModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ticketModel.TERMINAL_STATUSES", () => {
  it("should list the statuses that close a ticket", () => {
    expect(ticketModel.TERMINAL_STATUSES).toEqual(["Completed", "Unresolvable"]);
  });
});

describe("ticketModel.getHawkerCentres", () => {
  it("should return every active centre", async () => {
    const centres = [{ HawkerId: 1, Name: "Maxwell Food Centre" }];
    mockPool(rows(centres));

    await expect(ticketModel.getHawkerCentres()).resolves.toEqual(centres);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(ticketModel.getHawkerCentres()).rejects.toThrow("Database Error");
  });
});

describe("ticketModel.getAssignedHawkerCentres", () => {
  it("should return the operator's centres", async () => {
    const centres = [{ HawkerId: 1, Name: "Maxwell Food Centre" }];
    const { request } = mockPool(rows(centres));

    const result = await ticketModel.getAssignedHawkerCentres(2);

    expect(request.input).toHaveBeenCalledWith("OperatorId", sql.Int, 2);
    expect(result).toEqual(centres);
  });
});

describe("ticketModel.getAssignedHawkerIds", () => {
  it("should flatten the assigned centres to ids", async () => {
    mockPool(rows([{ HawkerId: 1 }, { HawkerId: 2 }]));

    await expect(ticketModel.getAssignedHawkerIds(2)).resolves.toEqual([1, 2]);
  });
});

describe("ticketModel.isOperatorAssignedToHawker", () => {
  it("should return true when the assignment exists", async () => {
    mockPool(rows([{ ok: 1 }]));

    await expect(ticketModel.isOperatorAssignedToHawker(2, 1)).resolves.toBe(true);
  });

  it("should return false when it does not", async () => {
    mockPool(rows([]));

    await expect(ticketModel.isOperatorAssignedToHawker(2, 9)).resolves.toBe(false);
  });
});

describe("ticketModel.createTicket", () => {
  it("should insert the ticket and return its new id", async () => {
    const { request } = mockPool(rows([{ TicketId: 41 }]));

    const ticketId = await ticketModel.createTicket({
      HawkerId: 1,
      UserId: 7,
      UserRole: "customer",
      Category: "Cleanliness",
      Subject: "Spill",
      Description: "Wet floor"
    });

    expect(request.input).toHaveBeenCalledWith("HawkerId", sql.Int, 1);
    expect(request.input).toHaveBeenCalledWith("OtherCategoryText", undefined, null);
    expect(ticketId).toBe(41);
  });
});

describe("ticketModel.addAttachments", () => {
  it("should insert one row per attachment", async () => {
    const { pool } = mockPool(rows([]));

    await ticketModel.addAttachments(41, [
      { fileName: "a.png", fileType: "image/png", fileSizeBytes: 10, storagePath: "/a.png" },
      { fileName: "b.png", fileType: "image/png", fileSizeBytes: 20, storagePath: "/b.png" }
    ]);

    expect(pool.request).toHaveBeenCalledTimes(2);
  });

  it("should do nothing when there are no attachments", async () => {
    await ticketModel.addAttachments(41, []);

    expect(sql.connect).not.toHaveBeenCalled();
  });
});

describe("ticketModel.getAttachmentsByTicketId", () => {
  it("should return the ticket's attachments", async () => {
    const attachments = [{ FileName: "a.png" }];
    mockPool(rows(attachments));

    await expect(ticketModel.getAttachmentsByTicketId(41)).resolves.toEqual(attachments);
  });
});

describe("ticketModel.getTicketById", () => {
  it("should return the ticket with its submitter and centre names", async () => {
    mockPool(rows([{ TicketId: 41, SubmitterUserName: "jaslyn", HawkerName: "Maxwell" }]));

    await expect(ticketModel.getTicketById(41)).resolves.toEqual({
      TicketId: 41,
      SubmitterUserName: "jaslyn",
      HawkerName: "Maxwell"
    });
  });

  it("should return undefined for an unknown ticket", async () => {
    mockPool(rows([]));

    await expect(ticketModel.getTicketById(999)).resolves.toBeUndefined();
  });
});

describe("ticketModel.getTicketsForSubmitter", () => {
  it("should exclude the terminal statuses for the open group", async () => {
    const { request } = mockPool(rows([]));

    await ticketModel.getTicketsForSubmitter(7, "open");

    expect(request.query.mock.calls[0][0]).toContain("Status NOT IN ('Completed','Unresolvable')");
  });

  it("should include only the terminal statuses for the closed group", async () => {
    const { request } = mockPool(rows([]));

    await ticketModel.getTicketsForSubmitter(7, "closed");

    expect(request.query.mock.calls[0][0]).toContain("Status IN ('Completed','Unresolvable')");
  });
});

describe("ticketModel.getTicketsForOperator", () => {
  it("should return an empty list when the operator has no centres", async () => {
    await expect(
      ticketModel.getTicketsForOperator({ hawkerIds: [], statusGroup: "open" })
    ).resolves.toEqual([]);
    expect(sql.connect).not.toHaveBeenCalled();
  });

  it("should parameterise every assigned centre id", async () => {
    const { request } = mockPool(rows([]));

    await ticketModel.getTicketsForOperator({ hawkerIds: [1, 2], statusGroup: "open" });

    expect(request.input).toHaveBeenCalledWith("hid0", sql.Int, 1);
    expect(request.input).toHaveBeenCalledWith("hid1", sql.Int, 2);
    expect(request.query.mock.calls[0][0]).toContain("t.HawkerId IN (@hid0,@hid1)");
  });

  it("should apply the category, centre and exact-status filters", async () => {
    const { request } = mockPool(rows([]));

    await ticketModel.getTicketsForOperator({
      hawkerIds: [1],
      statusGroup: "open",
      category: "Cleanliness",
      hawkerId: 1,
      status: "Testing"
    });

    const query = request.query.mock.calls[0][0];
    expect(query).toContain("t.HawkerId = @FilterHawkerId");
    expect(query).toContain("t.Category = @FilterCategory");
    expect(query).toContain("t.Status = @FilterStatus");
  });

  it("should sort closed tickets by when they were last updated", async () => {
    const { request } = mockPool(rows([]));

    await ticketModel.getTicketsForOperator({ hawkerIds: [1], statusGroup: "closed" });

    expect(request.query.mock.calls[0][0]).toContain("ORDER BY t.UpdatedAt DESC");
  });
});

describe("ticketModel.claimTicket", () => {
  it("should return true when an unclaimed ticket was taken", async () => {
    mockPool(affected(1));

    await expect(ticketModel.claimTicket(41, 2)).resolves.toBe(true);
  });

  it("should return false when the ticket was already claimed", async () => {
    mockPool(affected(0));

    await expect(ticketModel.claimTicket(41, 2)).resolves.toBe(false);
  });
});

describe("ticketModel.updateStatus", () => {
  it("should return true when the assigned operator updated it", async () => {
    mockPool(affected(1));

    await expect(ticketModel.updateStatus(41, 2, "Testing")).resolves.toBe(true);
  });

  it("should return false when another operator owns the ticket", async () => {
    mockPool(affected(0));

    await expect(ticketModel.updateStatus(41, 99, "Testing")).resolves.toBe(false);
  });
});

describe("ticketModel.closeTicket", () => {
  it("should write the closing status", async () => {
    const { request } = mockPool(affected(1));

    await ticketModel.closeTicket(41, "Completed");

    expect(request.input).toHaveBeenCalledWith("Status", undefined, "Completed");
  });

  it("should propagate a database error", async () => {
    mockPool(new Error("Database Error"));

    await expect(ticketModel.closeTicket(41, "Completed")).rejects.toThrow("Database Error");
  });
});
