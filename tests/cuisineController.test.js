const CuisineController = require("../controllers/cuisineController");
const CuisineModel = require("../models/cuisineModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/cuisineModel");

describe("CuisineController.getUserCuisines", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should flatten the stored rows to a list of cuisine names", async () => {
    CuisineModel.getUserCuisines.mockResolvedValue([
      { cuisineName: "Malay", createdAt: "2026-01-01" },
      { cuisineName: "Japanese", createdAt: "2026-01-02" }
    ]);

    const req = mockRequest({ params: { userId: "7" } });
    const res = mockResponse();

    await CuisineController.getUserCuisines(req, res, mockNext());

    expect(CuisineModel.getUserCuisines).toHaveBeenCalledWith(7);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user_id: 7, cuisines: ["Malay", "Japanese"] }
    });
  });

  it("should return an empty palette when nothing is saved", async () => {
    CuisineModel.getUserCuisines.mockResolvedValue([]);

    const req = mockRequest({ params: { userId: "7" } });
    const res = mockResponse();

    await CuisineController.getUserCuisines(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user_id: 7, cuisines: [] }
    });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    CuisineModel.getUserCuisines.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" } });
    const res = mockResponse();
    const next = mockNext();

    await CuisineController.getUserCuisines(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("CuisineController.replaceUserCuisines", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should save the palette and confirm it back", async () => {
    CuisineModel.replaceUserCuisines.mockResolvedValue(2);

    const req = mockRequest({ params: { userId: "7" }, body: { cuisines: ["Thai", "Korean"] } });
    const res = mockResponse();

    await CuisineController.replaceUserCuisines(req, res, mockNext());

    expect(CuisineModel.replaceUserCuisines).toHaveBeenCalledWith(7, ["Thai", "Korean"]);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Palette saved",
      data: { user_id: 7, cuisines: ["Thai", "Korean"] }
    });
  });

  it("should report the palette as cleared when an empty list is sent", async () => {
    CuisineModel.replaceUserCuisines.mockResolvedValue(0);

    const req = mockRequest({ params: { userId: "7" }, body: { cuisines: [] } });
    const res = mockResponse();

    await CuisineController.replaceUserCuisines(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Palette cleared",
      data: { user_id: 7, cuisines: [] }
    });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    CuisineModel.replaceUserCuisines.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" }, body: { cuisines: ["Thai"] } });
    const res = mockResponse();
    const next = mockNext();

    await CuisineController.replaceUserCuisines(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
