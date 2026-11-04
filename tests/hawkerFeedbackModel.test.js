const HawkerFeedbackModel = require("../models/hawkerFeedbackModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

describe("HawkerFeedbackModel.FACILITY_TAGS", () => {
  it("should expose the facility tag vocabulary", () => {
    expect(HawkerFeedbackModel.FACILITY_TAGS).toEqual([
      "Cleanliness",
      "Seating",
      "Toilets",
      "Ventilation",
      "Queue",
      "Other"
    ]);
  });
});

describe("HawkerFeedbackModel.submitFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should insert the feedback and return its new id", async () => {
    const { request } = mockPool(rows([{ FeedbackId: 31 }]));

    const feedbackId = await HawkerFeedbackModel.submitFeedback({
      hawkerId: 1,
      customerId: 7,
      rating: 4,
      facilityTag: "Seating",
      comment: "Enough tables."
    });

    expect(request.input).toHaveBeenCalledWith("HawkerId", sql.Int, 1);
    expect(request.input).toHaveBeenCalledWith("Rating", sql.Int, 4);
    expect(feedbackId).toBe(31);
  });

  it("should store a null comment when none was given", async () => {
    const { request } = mockPool(rows([{ FeedbackId: 32 }]));

    await HawkerFeedbackModel.submitFeedback({
      hawkerId: 1,
      customerId: 7,
      rating: 5,
      facilityTag: "Queue"
    });

    expect(request.input).toHaveBeenCalledWith("Comment", undefined, null);
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(
      HawkerFeedbackModel.submitFeedback({ hawkerId: 1, customerId: 7, rating: 4, facilityTag: "Seating" })
    ).rejects.toThrow("Database Error");
  });
});

describe("HawkerFeedbackModel.hawkerExists", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when a centre matches", async () => {
    mockPool(rows([{ ok: 1 }]));

    await expect(HawkerFeedbackModel.hawkerExists(1)).resolves.toBe(true);
  });

  it("should return false when no centre matches", async () => {
    mockPool(rows([]));

    await expect(HawkerFeedbackModel.hawkerExists(999)).resolves.toBe(false);
  });
});

describe("HawkerFeedbackModel.findByCustomer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the customer's feedback newest first", async () => {
    const feedback = [
      { feedback_id: 32, hawker_id: 1, rating: 5 },
      { feedback_id: 31, hawker_id: 1, rating: 4 }
    ];
    const { request } = mockPool(rows(feedback));

    const result = await HawkerFeedbackModel.findByCustomer(7);

    expect(request.input).toHaveBeenCalledWith("CustomerId", sql.Int, 7);
    expect(result).toEqual(feedback);
  });

  it("should return an empty list when the customer has left none", async () => {
    mockPool(rows([]));

    await expect(HawkerFeedbackModel.findByCustomer(7)).resolves.toEqual([]);
  });
});
