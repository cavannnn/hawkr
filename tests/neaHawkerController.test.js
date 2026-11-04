const neaHawkerController = require("../controllers/neaHawkerController");
const HawkerModel = require("../models/neaHawkerModel");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/neaHawkerModel");

describe("neaHawkerController.getHawkerCentres", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should fetch all hawker centres and return them as JSON", async () => {
    const centres = [
      { centreId: 1, centreName: "Maxwell Food Centre" },
      { centreId: 2, centreName: "Chinatown Complex" }
    ];
    HawkerModel.getAllHawkerCentres.mockResolvedValue(centres);

    const req = mockRequest();
    const res = mockResponse();

    await neaHawkerController.getHawkerCentres(req, res);

    expect(HawkerModel.getAllHawkerCentres).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(centres);
  });

  it("should respond 500 when the lookup fails", async () => {
    HawkerModel.getAllHawkerCentres.mockRejectedValue(new Error("Database error"));

    const req = mockRequest();
    const res = mockResponse();

    await neaHawkerController.getHawkerCentres(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch hawker centres." });
  });
});

describe("neaHawkerController.getStalls", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should fetch the stalls of the requested centre", async () => {
    const stalls = [{ stallId: 10, stallName: "Tian Tian Chicken Rice" }];
    HawkerModel.getStallsByCentre.mockResolvedValue(stalls);

    const req = mockRequest({ params: { centreId: "1" } });
    const res = mockResponse();

    await neaHawkerController.getStalls(req, res);

    expect(HawkerModel.getStallsByCentre).toHaveBeenCalledWith("1");
    expect(res.json).toHaveBeenCalledWith(stalls);
  });

  it("should respond 500 when the lookup fails", async () => {
    HawkerModel.getStallsByCentre.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { centreId: "1" } });
    const res = mockResponse();

    await neaHawkerController.getStalls(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch stalls." });
  });
});
