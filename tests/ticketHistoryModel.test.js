const ticketHistoryModel = require("../models/ticketHistoryModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ticketHistoryModel.insertHistory", () => {
  it("should write the closing record", async () => {
    const { request } = mockPool(rows([]));

    await ticketHistoryModel.insertHistory({
      TicketId: 41,
      UserId: 7,
      UserRole: "customer",
      Category: "Cleanliness",
      TicketDescription: "Wet floor",
      Message: "Cleaned up",
      Status: "Completed",
      ResolvedByUserId: 2
    });

    expect(request.input).toHaveBeenCalledWith("TicketId", sql.Int, 41);
    expect(request.input).toHaveBeenCalledWith("ResolvedByUserId", sql.Int, 2);
    expect(request.query).toHaveBeenCalledTimes(1);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(ticketHistoryModel.insertHistory({ TicketId: 41 })).rejects.toThrow("Database Error");
  });
});

describe("ticketHistoryModel.getLatestHistoryForTicket", () => {
  it("should return the most recent closing record", async () => {
    mockPool(rows([{ TicketHistoryId: 3, ResolvedByUserName: "operator1" }]));

    await expect(ticketHistoryModel.getLatestHistoryForTicket(41)).resolves.toEqual({
      TicketHistoryId: 3,
      ResolvedByUserName: "operator1"
    });
  });

  it("should return undefined when the ticket was never closed", async () => {
    mockPool(rows([]));

    await expect(ticketHistoryModel.getLatestHistoryForTicket(41)).resolves.toBeUndefined();
  });
});

describe("ticketHistoryModel.getHistoryForSubmitter", () => {
  it("should return the submitter's closed tickets newest first", async () => {
    const history = [{ TicketHistoryId: 4 }, { TicketHistoryId: 3 }];
    const { request } = mockPool(rows(history));

    const result = await ticketHistoryModel.getHistoryForSubmitter(7);

    expect(request.input).toHaveBeenCalledWith("UserId", sql.Int, 7);
    expect(result).toEqual(history);
  });
});

describe("ticketHistoryModel.getHistoryForOperator", () => {
  it("should return an empty list when the operator has no centres", async () => {
    await expect(ticketHistoryModel.getHistoryForOperator({ hawkerIds: [] })).resolves.toEqual([]);
    expect(sql.connect).not.toHaveBeenCalled();
  });

  it("should parameterise every assigned centre id", async () => {
    const { request } = mockPool(rows([]));

    await ticketHistoryModel.getHistoryForOperator({ hawkerIds: [1, 2] });

    expect(request.input).toHaveBeenCalledWith("hid0", sql.Int, 1);
    expect(request.query.mock.calls[0][0]).toContain("t.HawkerId IN (@hid0,@hid1)");
  });

  it("should apply the category, outcome and date filters", async () => {
    const { request } = mockPool(rows([]));

    await ticketHistoryModel.getHistoryForOperator({
      hawkerIds: [1],
      category: "Cleanliness",
      outcome: "Completed",
      dateFrom: "2026-01-01",
      dateTo: "2026-02-01"
    });

    const query = request.query.mock.calls[0][0];
    expect(query).toContain("th.Category = @FilterCategory");
    expect(query).toContain("th.Status = @FilterOutcome");
    expect(query).toContain("th.CompletedAt >= @DateFrom");
    expect(query).toContain("th.CompletedAt <= @DateTo");
  });
});

describe("ticketHistoryModel.getHistoryById", () => {
  it("should return the matching history row", async () => {
    const { request } = mockPool(rows([{ TicketHistoryId: 3 }]));

    const entry = await ticketHistoryModel.getHistoryById(3);

    expect(request.input).toHaveBeenCalledWith("TicketHistoryId", sql.Int, 3);
    expect(entry).toEqual({ TicketHistoryId: 3 });
  });

  it("should return undefined for an unknown id", async () => {
    mockPool(rows([]));

    await expect(ticketHistoryModel.getHistoryById(999)).resolves.toBeUndefined();
  });
});
