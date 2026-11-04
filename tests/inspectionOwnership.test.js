const { authorizeInspectionOwner } = require("../middleware/inspectionOwnership");
const inspectionModel = require("../models/inspectionModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/inspectionModel");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.error.mockRestore();
});

describe("inspectionOwnership.authorizeInspectionOwner", () => {
  it("should attach the inspection and continue for its own officer", async () => {
    const inspection = { inspectionId: 15, officerId: 3, stallId: 6 };
    inspectionModel.getInspectionById.mockResolvedValue(inspection);

    const req = mockRequest({ params: { id: "15" }, user: { userId: 3 } });
    const res = mockResponse();
    const next = mockNext();

    await authorizeInspectionOwner(req, res, next);

    expect(req.inspectionId).toBe(15);
    expect(req.inspection).toBe(inspection);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should respond 400 for a non-numeric id", async () => {
    const req = mockRequest({ params: { id: "abc" }, user: { userId: 3 } });
    const res = mockResponse();
    const next = mockNext();

    await authorizeInspectionOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid inspection id." });
    expect(inspectionModel.getInspectionById).not.toHaveBeenCalled();
  });

  it("should respond 400 for a zero id", async () => {
    const req = mockRequest({ params: { id: "0" }, user: { userId: 3 } });
    const res = mockResponse();
    const next = mockNext();

    await authorizeInspectionOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should respond 404 when the inspection does not exist", async () => {
    inspectionModel.getInspectionById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" }, user: { userId: 3 } });
    const res = mockResponse();
    const next = mockNext();

    await authorizeInspectionOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Inspection not found" });
  });

  it("should respond 403 for another officer's inspection", async () => {
    inspectionModel.getInspectionById.mockResolvedValue({ inspectionId: 15, officerId: 99 });

    const req = mockRequest({ params: { id: "15" }, user: { userId: 3 } });
    const res = mockResponse();
    const next = mockNext();

    await authorizeInspectionOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "You can only manage inspections that you created."
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should respond 500 when the lookup fails", async () => {
    inspectionModel.getInspectionById.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "15" }, user: { userId: 3 } });
    const res = mockResponse();
    const next = mockNext();

    await authorizeInspectionOwner(req, res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Error retrieving inspection" });
  });
});
