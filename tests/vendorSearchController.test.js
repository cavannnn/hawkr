const searchController = require("../controllers/vendorSearchController");
const Search = require("../models/vendorSearchModel");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/vendorSearchModel");

describe("vendorSearchController.search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the matches found for the vendor", async () => {
    const results = [
      { type: "Stall", label: "Ah Hock Chicken Rice", sublabel: "Unit 01-23", url: "storeDetail.html?stallId=3" }
    ];
    Search.search.mockResolvedValue(results);

    const req = mockRequest({ params: { id: "5" }, query: { q: "chicken" } });
    const res = mockResponse();

    await searchController.search(req, res);

    expect(Search.search).toHaveBeenCalledWith("5", "chicken");
    expect(res.json).toHaveBeenCalledWith({ results });
  });

  it("should trim the query before searching", async () => {
    Search.search.mockResolvedValue([]);

    const req = mockRequest({ params: { id: "5" }, query: { q: "  laksa  " } });
    const res = mockResponse();

    await searchController.search(req, res);

    expect(Search.search).toHaveBeenCalledWith("5", "laksa");
  });

  it("should return an empty list without querying for a search term under 2 characters", async () => {
    const req = mockRequest({ params: { id: "5" }, query: { q: "a" } });
    const res = mockResponse();

    await searchController.search(req, res);

    expect(Search.search).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ results: [] });
  });

  it("should treat a missing search term as empty", async () => {
    const req = mockRequest({ params: { id: "5" }, query: {} });
    const res = mockResponse();

    await searchController.search(req, res);

    expect(Search.search).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ results: [] });
  });

  it("should respond 500 when the search fails", async () => {
    Search.search.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" }, query: { q: "chicken" } });
    const res = mockResponse();

    await searchController.search(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});
