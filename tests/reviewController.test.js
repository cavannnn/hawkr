const ReviewController = require("../controllers/reviewController");
const ReviewModel = require("../models/reviewModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/reviewModel");

describe("ReviewController.createReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create a review with the author taken from the token", async () => {
    ReviewModel.create.mockResolvedValue(21);

    const req = mockRequest({
      user: { id: 7 },
      body: { orderId: 12, stallId: 3, rating: 5, comment: "Very good." }
    });
    const res = mockResponse();

    await ReviewController.createReview(req, res, mockNext());

    expect(ReviewModel.create).toHaveBeenCalledWith({
      order_id: 12,
      stall_id: 3,
      customer_id: 7,
      rating: 5,
      comment: "Very good."
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Review submitted successfully",
      data: { review_id: 21, feedbackId: 21 }
    });
  });

  it("should relay the status code carried by a model error", async () => {
    const error = new Error("You can only review your own orders");
    error.statusCode = 403;
    ReviewModel.create.mockRejectedValue(error);

    const req = mockRequest({ user: { id: 7 }, body: { orderId: 12, rating: 5 } });
    const res = mockResponse();
    const next = mockNext();

    await ReviewController.createReview(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "You can only review your own orders"
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should pass an unexpected failure to the error handler", async () => {
    const error = new Error("Database error");
    ReviewModel.create.mockRejectedValue(error);

    const req = mockRequest({ user: { id: 7 }, body: { orderId: 12, rating: 5 } });
    const res = mockResponse();
    const next = mockNext();

    await ReviewController.createReview(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("ReviewController.getCustomerReviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return every review a customer has written", async () => {
    const reviews = [{ review_id: 21, rating: 5 }];
    ReviewModel.findByCustomer.mockResolvedValue(reviews);

    const req = mockRequest({ params: { customerId: "7" } });
    const res = mockResponse();

    await ReviewController.getCustomerReviews(req, res, mockNext());

    expect(ReviewModel.findByCustomer).toHaveBeenCalledWith("7");
    expect(res.json).toHaveBeenCalledWith({ success: true, data: reviews });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    ReviewModel.findByCustomer.mockRejectedValue(error);

    const req = mockRequest({ params: { customerId: "7" } });
    const res = mockResponse();
    const next = mockNext();

    await ReviewController.getCustomerReviews(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("ReviewController.getStallReviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should map each review to the stall profile shape", async () => {
    ReviewModel.findByStall.mockResolvedValue([
      {
        review_id: 21,
        stall_id: 3,
        customer_name: "Jaslyn",
        rating: 5,
        comment: "Very good.",
        created_at: "2026-02-01"
      }
    ]);

    const req = mockRequest({ params: { stallId: "3" } });
    const res = mockResponse();

    await ReviewController.getStallReviews(req, res, mockNext());

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: [
        {
          FeedbackId: 21,
          StallId: 3,
          UserName: "Jaslyn",
          FeedbackRating: 5,
          FeedbackComment: "Very good.",
          FeedbackDateTime: "2026-02-01"
        }
      ]
    });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    ReviewModel.findByStall.mockRejectedValue(error);

    const req = mockRequest({ params: { stallId: "3" } });
    const res = mockResponse();
    const next = mockNext();

    await ReviewController.getStallReviews(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("ReviewController.getOrderReviews", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should scope the lookup to the signed-in customer", async () => {
    const reviews = [{ FeedbackId: 21 }];
    ReviewModel.findByOrderForCustomer.mockResolvedValue(reviews);

    const req = mockRequest({ params: { orderId: "12" }, user: { id: 7 } });
    const res = mockResponse();

    await ReviewController.getOrderReviews(req, res, mockNext());

    expect(ReviewModel.findByOrderForCustomer).toHaveBeenCalledWith("12", 7);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: reviews });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    ReviewModel.findByOrderForCustomer.mockRejectedValue(error);

    const req = mockRequest({ params: { orderId: "12" }, user: { id: 7 } });
    const res = mockResponse();
    const next = mockNext();

    await ReviewController.getOrderReviews(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("ReviewController.updateReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should update the caller's own review", async () => {
    ReviewModel.updateOwn.mockResolvedValue(true);

    const req = mockRequest({
      params: { reviewId: "21" },
      user: { id: 7 },
      body: { rating: 4, comment: "Still good." }
    });
    const res = mockResponse();

    await ReviewController.updateReview(req, res, mockNext());

    expect(ReviewModel.updateOwn).toHaveBeenCalledWith("21", 7, { rating: 4, comment: "Still good." });
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Review updated",
      data: { review_id: 21, rating: 4, comment: "Still good." }
    });
  });

  it("should respond 404 when the review is not the caller's", async () => {
    ReviewModel.updateOwn.mockResolvedValue(false);

    const req = mockRequest({ params: { reviewId: "21" }, user: { id: 7 }, body: { rating: 4 } });
    const res = mockResponse();

    await ReviewController.updateReview(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Review not found" });
  });

  it("should relay the status code carried by a model error", async () => {
    const error = new Error("Rating out of range");
    error.statusCode = 400;
    ReviewModel.updateOwn.mockRejectedValue(error);

    const req = mockRequest({ params: { reviewId: "21" }, user: { id: 7 }, body: { rating: 9 } });
    const res = mockResponse();

    await ReviewController.updateReview(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("ReviewController.deleteReview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete the caller's own review", async () => {
    ReviewModel.deleteOwn.mockResolvedValue(true);

    const req = mockRequest({ params: { reviewId: "21" }, user: { id: 7 } });
    const res = mockResponse();

    await ReviewController.deleteReview(req, res, mockNext());

    expect(ReviewModel.deleteOwn).toHaveBeenCalledWith("21", 7);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Review deleted" });
  });

  it("should respond 404 when the review is not the caller's", async () => {
    ReviewModel.deleteOwn.mockResolvedValue(false);

    const req = mockRequest({ params: { reviewId: "21" }, user: { id: 7 } });
    const res = mockResponse();

    await ReviewController.deleteReview(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Review not found" });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    ReviewModel.deleteOwn.mockRejectedValue(error);

    const req = mockRequest({ params: { reviewId: "21" }, user: { id: 7 } });
    const res = mockResponse();
    const next = mockNext();

    await ReviewController.deleteReview(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
