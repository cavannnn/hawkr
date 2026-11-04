const HawkerController = require("../controllers/hawkerController");
const HawkerModel = require("../models/hawkerModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/hawkerModel");

describe("HawkerController.getAllHawkers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch all hawker centres and return a JSON response", async () => {
    const hawkers = [
      { hawker_id: 1, name: "Maxwell Food Centre", stalls: [] },
      { hawker_id: 2, name: "Chinatown Complex", stalls: [] }
    ];
    HawkerModel.findAll.mockResolvedValue(hawkers);

    const req = mockRequest();
    const res = mockResponse();

    await HawkerController.getAllHawkers(req, res, mockNext());

    expect(HawkerModel.findAll).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: hawkers });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    HawkerModel.findAll.mockRejectedValue(error);

    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    await HawkerController.getAllHawkers(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("HawkerController.getHawkerById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the requested hawker centre", async () => {
    const hawker = { hawker_id: 1, name: "Maxwell Food Centre", stalls: [] };
    HawkerModel.findById.mockResolvedValue(hawker);

    const req = mockRequest({ params: { hawkerId: "1" } });
    const res = mockResponse();

    await HawkerController.getHawkerById(req, res, mockNext());

    expect(HawkerModel.findById).toHaveBeenCalledWith("1");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: hawker });
  });

  it("should respond 404 when the centre does not exist", async () => {
    HawkerModel.findById.mockResolvedValue(null);

    const req = mockRequest({ params: { hawkerId: "999" } });
    const res = mockResponse();

    await HawkerController.getHawkerById(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Hawker centre not found" });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    HawkerModel.findById.mockRejectedValue(error);

    const req = mockRequest({ params: { hawkerId: "1" } });
    const res = mockResponse();
    const next = mockNext();

    await HawkerController.getHawkerById(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
