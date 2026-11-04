const HawkerFeedbackController = require("../controllers/hawkerFeedbackController");
const HawkerFeedbackModel = require("../models/hawkerFeedbackModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/hawkerFeedbackModel");

const FACILITY_TAGS = ["Cleanliness", "Seating", "Toilets", "Ventilation", "Queue", "Other"];

function feedbackRequest(overrides) {
  return mockRequest(
    Object.assign(
      {
        params: { hawkerId: "1" },
        user: { id: 7 },
        body: { rating: 4, facility_tag: "Seating", comment: "Enough tables at lunch." }
      },
      overrides
    )
  );
}

describe("HawkerFeedbackController.submitFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(HawkerFeedbackModel, "FACILITY_TAGS", {
      value: FACILITY_TAGS,
      configurable: true
    });
  });

  it("should store the feedback and return its new id", async () => {
    HawkerFeedbackModel.hawkerExists.mockResolvedValue(true);
    HawkerFeedbackModel.submitFeedback.mockResolvedValue(31);

    const req = feedbackRequest();
    const res = mockResponse();

    await HawkerFeedbackController.submitFeedback(req, res, mockNext());

    expect(HawkerFeedbackModel.submitFeedback).toHaveBeenCalledWith({
      hawkerId: 1,
      customerId: 7,
      rating: 4,
      facilityTag: "Seating",
      comment: "Enough tables at lunch."
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Feedback submitted",
      data: { feedback_id: 31 }
    });
  });

  it("should respond 400 for a hawker id that is not a number", async () => {
    const req = feedbackRequest({ params: { hawkerId: "abc" } });
    const res = mockResponse();

    await HawkerFeedbackController.submitFeedback(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "A valid hawkerId is required" });
  });

  it("should respond 400 when the rating is missing", async () => {
    const req = feedbackRequest({ body: { facility_tag: "Seating" } });
    const res = mockResponse();

    await HawkerFeedbackController.submitFeedback(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "rating and facility_tag are required"
    });
  });

  it("should respond 400 when the rating is outside 1 to 5", async () => {
    const req = feedbackRequest({ body: { rating: 6, facility_tag: "Seating" } });
    const res = mockResponse();

    await HawkerFeedbackController.submitFeedback(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "rating must be a whole number between 1 and 5"
    });
  });

  it("should respond 400 for a facility tag outside the allowed list", async () => {
    const req = feedbackRequest({ body: { rating: 4, facility_tag: "Parking" } });
    const res = mockResponse();

    await HawkerFeedbackController.submitFeedback(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toContain("facility_tag must be one of");
  });

  it("should respond 400 for a comment longer than 1000 characters", async () => {
    const req = feedbackRequest({
      body: { rating: 4, facility_tag: "Seating", comment: "x".repeat(1001) }
    });
    const res = mockResponse();

    await HawkerFeedbackController.submitFeedback(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "comment must be 1000 characters or fewer"
    });
  });

  it("should respond 404 when the hawker centre does not exist", async () => {
    HawkerFeedbackModel.hawkerExists.mockResolvedValue(false);

    const req = feedbackRequest();
    const res = mockResponse();

    await HawkerFeedbackController.submitFeedback(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Hawker centre not found" });
    expect(HawkerFeedbackModel.submitFeedback).not.toHaveBeenCalled();
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    HawkerFeedbackModel.hawkerExists.mockRejectedValue(error);

    const req = feedbackRequest();
    const res = mockResponse();
    const next = mockNext();

    await HawkerFeedbackController.submitFeedback(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("HawkerFeedbackController.getMyFeedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the feedback written by the signed-in customer", async () => {
    const feedback = [{ feedback_id: 31, rating: 4 }];
    HawkerFeedbackModel.findByCustomer.mockResolvedValue(feedback);

    const req = mockRequest({ user: { id: 7 } });
    const res = mockResponse();

    await HawkerFeedbackController.getMyFeedback(req, res, mockNext());

    expect(HawkerFeedbackModel.findByCustomer).toHaveBeenCalledWith(7);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: feedback });
  });

  it("should fall back to the UserId claim when id is absent", async () => {
    HawkerFeedbackModel.findByCustomer.mockResolvedValue([]);

    const req = mockRequest({ user: { UserId: 12 } });
    const res = mockResponse();

    await HawkerFeedbackController.getMyFeedback(req, res, mockNext());

    expect(HawkerFeedbackModel.findByCustomer).toHaveBeenCalledWith(12);
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    HawkerFeedbackModel.findByCustomer.mockRejectedValue(error);

    const req = mockRequest({ user: { id: 7 } });
    const res = mockResponse();
    const next = mockNext();

    await HawkerFeedbackController.getMyFeedback(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("HawkerFeedbackController.getFacilityTags", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(HawkerFeedbackModel, "FACILITY_TAGS", {
      value: FACILITY_TAGS,
      configurable: true
    });
  });

  it("should return the facility tag vocabulary", async () => {
    const req = mockRequest();
    const res = mockResponse();

    await HawkerFeedbackController.getFacilityTags(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({ success: true, data: FACILITY_TAGS });
  });
});
