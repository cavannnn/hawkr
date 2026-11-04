const historyController = require("../controllers/rentalAgreementHistoryController");
const historyModel = require("../models/rentalAgreementHistoryModel");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/rentalAgreementHistoryModel");

describe("rentalAgreementHistoryController.getAllHistory", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return every archived agreement", async () => {
    const history = [
      { HistoryId: 1, AgreementId: 4, Status: "Expired" },
      { HistoryId: 2, AgreementId: 5, Status: "Cancelled" }
    ];
    historyModel.getAllHistory.mockResolvedValue(history);

    const req = mockRequest();
    const res = mockResponse();

    await historyController.getAllHistory(req, res);

    expect(historyModel.getAllHistory).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(history);
  });

  it("should respond 500 when the lookup fails", async () => {
    historyModel.getAllHistory.mockRejectedValue(new Error("Database error"));

    const req = mockRequest();
    const res = mockResponse();

    await historyController.getAllHistory(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch rental agreement history" });
  });
});

describe("rentalAgreementHistoryController.getHistoryById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the requested history entry", async () => {
    const entry = { HistoryId: 1, AgreementId: 4, Status: "Expired" };
    historyModel.getHistoryById.mockResolvedValue(entry);

    const req = mockRequest({ params: { id: "1" } });
    const res = mockResponse();

    await historyController.getHistoryById(req, res);

    expect(historyModel.getHistoryById).toHaveBeenCalledWith("1");
    expect(res.json).toHaveBeenCalledWith(entry);
  });

  it("should respond 404 when the entry does not exist", async () => {
    historyModel.getHistoryById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" } });
    const res = mockResponse();

    await historyController.getHistoryById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "History entry not found" });
  });

  it("should respond 500 when the lookup fails", async () => {
    historyModel.getHistoryById.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "1" } });
    const res = mockResponse();

    await historyController.getHistoryById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch history entry" });
  });
});
