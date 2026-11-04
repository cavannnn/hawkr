const FavoriteController = require("../controllers/favoriteController");
const FavoriteModel = require("../models/favoriteModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/favoriteModel");

describe("FavoriteController.toggleFavorite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should report an added favourite", async () => {
    const result = { favorited: true, action: "added", favorite_id: 4 };
    FavoriteModel.toggleFavorite.mockResolvedValue(result);

    const req = mockRequest({
      params: { userId: "7" },
      body: { hawker_id: "1", stall_id: "3", menu_id: "9" }
    });
    const res = mockResponse();

    await FavoriteController.toggleFavorite(req, res, mockNext());

    expect(FavoriteModel.toggleFavorite).toHaveBeenCalledWith(7, 1, 3, 9);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Added to favorites",
      data: result
    });
  });

  it("should report a removed favourite", async () => {
    FavoriteModel.toggleFavorite.mockResolvedValue({ favorited: false, action: "removed" });

    const req = mockRequest({ params: { userId: "7" }, body: { hawker_id: 1 } });
    const res = mockResponse();

    await FavoriteController.toggleFavorite(req, res, mockNext());

    expect(res.json.mock.calls[0][0].message).toBe("Removed from favorites");
  });

  it("should pass null for a centre-level favourite", async () => {
    FavoriteModel.toggleFavorite.mockResolvedValue({ action: "added" });

    const req = mockRequest({ params: { userId: "7" }, body: { hawker_id: "1" } });
    const res = mockResponse();

    await FavoriteController.toggleFavorite(req, res, mockNext());

    expect(FavoriteModel.toggleFavorite).toHaveBeenCalledWith(7, 1, null, null);
  });

  it("should respond 400 when hawker_id is missing", async () => {
    const req = mockRequest({ params: { userId: "7" }, body: {} });
    const res = mockResponse();

    await FavoriteController.toggleFavorite(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "hawker_id is required" });
    expect(FavoriteModel.toggleFavorite).not.toHaveBeenCalled();
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    FavoriteModel.toggleFavorite.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" }, body: { hawker_id: 1 } });
    const res = mockResponse();
    const next = mockNext();

    await FavoriteController.toggleFavorite(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("FavoriteController.getUserFavorites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the customer's favourites with a count", async () => {
    const favorites = [{ favorite_id: 4 }, { favorite_id: 5 }];
    FavoriteModel.getUserFavorites.mockResolvedValue(favorites);

    const req = mockRequest({ params: { userId: "7" }, query: { type: "stall" } });
    const res = mockResponse();

    await FavoriteController.getUserFavorites(req, res, mockNext());

    expect(FavoriteModel.getUserFavorites).toHaveBeenCalledWith(7, "stall");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: favorites, count: 2 });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    FavoriteModel.getUserFavorites.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" }, query: {} });
    const res = mockResponse();
    const next = mockNext();

    await FavoriteController.getUserFavorites(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("FavoriteController.getFavoriteCounts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return how many customers saved the item", async () => {
    FavoriteModel.getFavoriteCounts.mockResolvedValue(12);

    const req = mockRequest({ params: { hawkerId: "1" }, query: { stall_id: "3" } });
    const res = mockResponse();

    await FavoriteController.getFavoriteCounts(req, res, mockNext());

    expect(FavoriteModel.getFavoriteCounts).toHaveBeenCalledWith(1, 3, null);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { hawker_id: 1, stall_id: 3, menu_id: null, favorite_count: 12 }
    });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    FavoriteModel.getFavoriteCounts.mockRejectedValue(error);

    const req = mockRequest({ params: { hawkerId: "1" }, query: {} });
    const res = mockResponse();
    const next = mockNext();

    await FavoriteController.getFavoriteCounts(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("FavoriteController.checkFavorited", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should report whether the item is saved", async () => {
    FavoriteModel.isFavorited.mockResolvedValue(true);

    const req = mockRequest({
      params: { userId: "7" },
      query: { hawker_id: "1", stall_id: "3", menu_id: "9" }
    });
    const res = mockResponse();

    await FavoriteController.checkFavorited(req, res, mockNext());

    expect(FavoriteModel.isFavorited).toHaveBeenCalledWith(7, 1, 3, 9);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user_id: 7, hawker_id: 1, stall_id: 3, menu_id: 9, is_favorited: true }
    });
  });

  it("should respond 400 when hawker_id is missing", async () => {
    const req = mockRequest({ params: { userId: "7" }, query: {} });
    const res = mockResponse();

    await FavoriteController.checkFavorited(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(FavoriteModel.isFavorited).not.toHaveBeenCalled();
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    FavoriteModel.isFavorited.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" }, query: { hawker_id: "1" } });
    const res = mockResponse();
    const next = mockNext();

    await FavoriteController.checkFavorited(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("FavoriteController.deleteUserFavorites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should report how many favourites were removed", async () => {
    FavoriteModel.deleteUserFavorites.mockResolvedValue(3);

    const req = mockRequest({ params: { userId: "7" }, body: { hawker_id: "1" } });
    const res = mockResponse();

    await FavoriteController.deleteUserFavorites(req, res, mockNext());

    expect(FavoriteModel.deleteUserFavorites).toHaveBeenCalledWith(7, 1, null, null);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Removed 3 favorite(s)",
      data: { deleted_count: 3 }
    });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    FavoriteModel.deleteUserFavorites.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" }, body: {} });
    const res = mockResponse();
    const next = mockNext();

    await FavoriteController.deleteUserFavorites(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
