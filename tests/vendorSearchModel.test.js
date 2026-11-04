const Search = require("../models/vendorSearchModel");
const sql = require("mssql");
const { mockTaggedQuery, rows } = require("./helpers/dbMock");

jest.mock("mssql");

describe("vendorSearchModel.search", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should collect matches from every table the vendor owns", async () => {
    mockTaggedQuery([
      rows([{ stallId: 3, stallName: "Ah Hock Chicken Rice", unitNumber: "01-23" }]),
      rows([{ menuId: 1, itemName: "Chicken Rice", stallId: 3, stallName: "Ah Hock" }]),
      rows([{ stockItemId: 1, itemName: "Chicken", stallId: 3, stallName: "Ah Hock" }]),
      rows([{ promotionId: 4, name: "Lunch Deal", stallId: 3, stallName: "Ah Hock" }]),
      rows([{ voucherId: 8, code: "SAVE10", stallId: 3, stallName: "Ah Hock" }]),
      rows([{ orderId: 12, customerName: "Jaslyn", stallId: 3, stallName: "Ah Hock" }])
    ]);

    const results = await Search.search(5, "chicken");

    expect(sql.query).toHaveBeenCalledTimes(6);
    expect(results.map(r => r.type)).toEqual([
      "Stall",
      "Menu Item",
      "Stock Item",
      "Promotion",
      "Voucher",
      "Order"
    ]);
  });

  it("should build a jump-to link for each result", async () => {
    mockTaggedQuery([
      rows([{ stallId: 3, stallName: "Ah Hock Chicken Rice", unitNumber: "01-23" }]),
      rows([]),
      rows([]),
      rows([]),
      rows([]),
      rows([])
    ]);

    const results = await Search.search(5, "chicken");

    expect(results[0]).toEqual({
      type: "Stall",
      label: "Ah Hock Chicken Rice",
      sublabel: "Unit 01-23",
      url: "storeDetail.html?stallId=3"
    });
  });

  it("should label an order with no customer name", async () => {
    mockTaggedQuery([
      rows([]),
      rows([]),
      rows([]),
      rows([]),
      rows([]),
      rows([{ orderId: 12, customerName: null, stallId: 3, stallName: "Ah Hock" }])
    ]);

    const results = await Search.search(5, "12");

    expect(results[0].label).toBe("Order #12");
    expect(results[0].sublabel).toBe("Unknown customer · Ah Hock");
  });

  it("should return an empty list when nothing matches", async () => {
    mockTaggedQuery(rows([]));

    await expect(Search.search(5, "nothing")).resolves.toEqual([]);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database Error"));

    await expect(Search.search(5, "chicken")).rejects.toThrow("Database Error");
  });
});
