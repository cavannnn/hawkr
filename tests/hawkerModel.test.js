const HawkerModel = require("../models/hawkerModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

describe("HawkerModel.findAll", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should parse the nested stalls JSON on every centre", async () => {
    mockPool(rows([
      {
        hawker_id: 1,
        name: "Maxwell Food Centre",
        stalls: JSON.stringify([{ stall_id: 3, stall_name: "Ah Hock" }])
      }
    ]));

    const centres = await HawkerModel.findAll();

    expect(centres[0].stalls).toEqual([{ stall_id: 3, stall_name: "Ah Hock" }]);
  });

  it("should default to an empty stall list when the centre has none", async () => {
    mockPool(rows([{ hawker_id: 1, name: "Maxwell Food Centre", stalls: null }]));

    const centres = await HawkerModel.findAll();

    expect(centres[0].stalls).toEqual([]);
  });

  it("should return an empty list when there are no centres", async () => {
    mockPool(rows([]));

    await expect(HawkerModel.findAll()).resolves.toEqual([]);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(HawkerModel.findAll()).rejects.toThrow("Database Error");
  });
});

describe("HawkerModel.findById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the centre with its stalls parsed", async () => {
    const { request } = mockPool(rows([
      {
        hawker_id: 1,
        name: "Maxwell Food Centre",
        stalls: JSON.stringify([{ stall_id: 3 }])
      }
    ]));

    const centre = await HawkerModel.findById(1);

    expect(request.input).toHaveBeenCalledWith("hawkerId", sql.Int, 1);
    expect(centre.stalls).toEqual([{ stall_id: 3 }]);
  });

  it("should default to an empty stall list", async () => {
    mockPool(rows([{ hawker_id: 1, name: "Maxwell Food Centre", stalls: null }]));

    const centre = await HawkerModel.findById(1);

    expect(centre.stalls).toEqual([]);
  });

  it("should return null when the centre does not exist", async () => {
    mockPool(rows([]));

    await expect(HawkerModel.findById(999)).resolves.toBeNull();
  });
});
