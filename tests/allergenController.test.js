const AllergenController = require("../controllers/allergenController");
const AllergenModel = require("../models/allergenModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/allergenModel");

describe("AllergenController.getUserAllergens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should split the stored set into standard and custom allergens", async () => {
    AllergenModel.getUserAllergens.mockResolvedValue([
      { allergenName: "seafood" },
      { allergenName: "durian" },
      { allergenName: "nuts" }
    ]);

    const req = mockRequest({ params: { userId: "7" } });
    const res = mockResponse();

    await AllergenController.getUserAllergens(req, res, mockNext());

    expect(AllergenModel.getUserAllergens).toHaveBeenCalledWith(7);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user_id: 7, allergens: ["seafood", "nuts"], customAllergens: ["durian"] }
    });
  });

  it("should return empty lists when nothing is saved", async () => {
    AllergenModel.getUserAllergens.mockResolvedValue([]);

    const req = mockRequest({ params: { userId: "7" } });
    const res = mockResponse();

    await AllergenController.getUserAllergens(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user_id: 7, allergens: [], customAllergens: [] }
    });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    AllergenModel.getUserAllergens.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" } });
    const res = mockResponse();
    const next = mockNext();

    await AllergenController.getUserAllergens(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("AllergenController.replaceUserAllergens", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should store standard and custom allergens as one flat set", async () => {
    AllergenModel.replaceUserAllergens.mockResolvedValue(3);

    const req = mockRequest({
      params: { userId: "7" },
      body: { allergens: ["seafood", "nuts"], customAllergens: ["durian"] }
    });
    const res = mockResponse();

    await AllergenController.replaceUserAllergens(req, res, mockNext());

    expect(AllergenModel.replaceUserAllergens).toHaveBeenCalledWith(7, ["seafood", "nuts", "durian"]);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Allergens saved",
      data: { user_id: 7, allergens: ["seafood", "nuts"], customAllergens: ["durian"] }
    });
  });

  it("should remove duplicates before storing", async () => {
    AllergenModel.replaceUserAllergens.mockResolvedValue(1);

    const req = mockRequest({
      params: { userId: "7" },
      body: { allergens: ["seafood"], customAllergens: ["seafood"] }
    });
    const res = mockResponse();

    await AllergenController.replaceUserAllergens(req, res, mockNext());

    expect(AllergenModel.replaceUserAllergens).toHaveBeenCalledWith(7, ["seafood"]);
  });

  it("should report the set as cleared when both lists are empty", async () => {
    AllergenModel.replaceUserAllergens.mockResolvedValue(0);

    const req = mockRequest({
      params: { userId: "7" },
      body: { allergens: [], customAllergens: [] }
    });
    const res = mockResponse();

    await AllergenController.replaceUserAllergens(req, res, mockNext());

    expect(res.json.mock.calls[0][0].message).toBe("Allergens cleared");
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    AllergenModel.replaceUserAllergens.mockRejectedValue(error);

    const req = mockRequest({
      params: { userId: "7" },
      body: { allergens: ["seafood"], customAllergens: [] }
    });
    const res = mockResponse();
    const next = mockNext();

    await AllergenController.replaceUserAllergens(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
