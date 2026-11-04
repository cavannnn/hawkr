const FavoriteModel = require("../models/favoriteModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("FavoriteModel.toggleFavorite", () => {
  it("should add a favourite that is not saved yet", async () => {
    mockPool([rows([]), rows([{ favorite_id: 4 }])]);

    const result = await FavoriteModel.toggleFavorite(7, 1, 3, null);

    expect(result).toEqual({ favorited: true, action: "added", favorite_id: 4 });
  });

  it("should remove a favourite that is already saved", async () => {
    mockPool([rows([{ favoriteId: 4 }]), affected(1)]);

    const result = await FavoriteModel.toggleFavorite(7, 1, 3, null);

    expect(result).toEqual({ favorited: false, action: "removed" });
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(FavoriteModel.toggleFavorite(7, 1)).rejects.toThrow("Database Error");
  });
});

describe("FavoriteModel.getUserFavorites", () => {
  it("should return every favourite when no type is given", async () => {
    const favorites = [{ favorite_id: 4 }, { favorite_id: 5 }];
    const { request } = mockPool(rows(favorites));

    const result = await FavoriteModel.getUserFavorites(7);

    expect(request.input).toHaveBeenCalledWith("userId", sql.Int, 7);
    expect(result).toEqual(favorites);
  });

  it("should narrow to centre-level favourites", async () => {
    const { request } = mockPool(rows([]));

    await FavoriteModel.getUserFavorites(7, "hawker");

    expect(request.query.mock.calls[0][0]).toContain("f.stallId IS NULL AND f.menuId IS NULL");
  });

  it("should narrow to stall-level favourites", async () => {
    const { request } = mockPool(rows([]));

    await FavoriteModel.getUserFavorites(7, "stall");

    expect(request.query.mock.calls[0][0]).toContain("f.stallId IS NOT NULL AND f.menuId IS NULL");
  });

  it("should narrow to menu-level favourites", async () => {
    const { request } = mockPool(rows([]));

    await FavoriteModel.getUserFavorites(7, "menu");

    expect(request.query.mock.calls[0][0]).toContain("f.menuId IS NOT NULL");
  });
});

describe("FavoriteModel.getFavoriteCounts", () => {
  it("should count centre-level favourites", async () => {
    const { request } = mockPool(rows([{ favorite_count: 12 }]));

    const count = await FavoriteModel.getFavoriteCounts(1);

    expect(request.query.mock.calls[0][0]).toContain("stallId IS NULL");
    expect(count).toBe(12);
  });

  it("should count favourites for one stall", async () => {
    const { request } = mockPool(rows([{ favorite_count: 4 }]));

    const count = await FavoriteModel.getFavoriteCounts(1, 3);

    expect(request.input).toHaveBeenCalledWith("stallId", sql.Int, 3);
    expect(count).toBe(4);
  });

  it("should count favourites for one menu item", async () => {
    const { request } = mockPool(rows([{ favorite_count: 2 }]));

    await FavoriteModel.getFavoriteCounts(1, 3, 9);

    expect(request.input).toHaveBeenCalledWith("menuId", sql.Int, 9);
  });
});

describe("FavoriteModel.isFavorited", () => {
  it("should return true when a row matches", async () => {
    mockPool(rows([{ favoriteId: 4 }]));

    await expect(FavoriteModel.isFavorited(7, 1, 3, null)).resolves.toBe(true);
  });

  it("should return false when nothing matches", async () => {
    mockPool(rows([]));

    await expect(FavoriteModel.isFavorited(7, 1, 3, null)).resolves.toBe(false);
  });
});

describe("FavoriteModel.deleteUserFavorites", () => {
  it("should clear every favourite when no filters are given", async () => {
    const { request } = mockPool(affected(5));

    const deleted = await FavoriteModel.deleteUserFavorites(7);

    expect(request.query.mock.calls[0][0]).toBe("DELETE FROM Favorites WHERE userId = @userId");
    expect(deleted).toBe(5);
  });

  it("should narrow the delete by centre, stall and menu item", async () => {
    const { request } = mockPool(affected(1));

    await FavoriteModel.deleteUserFavorites(7, 1, 3, 9);

    const query = request.query.mock.calls[0][0];
    expect(query).toContain("centreId = @centreId");
    expect(query).toContain("stallId = @stallId");
    expect(query).toContain("menuId = @menuId");
  });

  it("should return zero when nothing was saved", async () => {
    mockPool(affected(0));

    await expect(FavoriteModel.deleteUserFavorites(7, 1)).resolves.toBe(0);
  });
});
