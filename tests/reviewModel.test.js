const ReviewModel = require("../models/reviewModel");
const NotificationModel = require("../models/notificationModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");
jest.mock("../models/notificationModel");

beforeEach(() => {
  jest.clearAllMocks();
});

function orderRow(overrides) {
  return Object.assign(
    {
      orderId: 12,
      customerId: 7,
      status: "completed",
      customerName: "Jaslyn",
      stallId: 3,
      vendorId: 5,
      stallName: "Ah Hock"
    },
    overrides
  );
}

describe("ReviewModel.create", () => {
  it("should store the review and notify the vendor", async () => {
    mockPool([rows([orderRow()]), rows([]), rows([{ review_id: 21 }])]);

    const reviewId = await ReviewModel.create({
      order_id: 12,
      stall_id: 3,
      customer_id: 7,
      rating: 5,
      comment: "Very good."
    });

    expect(reviewId).toBe(21);
    expect(NotificationModel.createNotification).toHaveBeenCalledWith(
      5,
      "review",
      "New customer review",
      expect.stringContaining("Ah Hock"),
      "storeDetail.html?stallId=3",
      "review",
      21
    );
  });

  it("should skip the notification when the stall has no vendor", async () => {
    mockPool([rows([orderRow({ vendorId: null })]), rows([]), rows([{ review_id: 22 }])]);

    await ReviewModel.create({ order_id: 12, stall_id: 3, customer_id: 7, rating: 5 });

    expect(NotificationModel.createNotification).not.toHaveBeenCalled();
  });

  it("should reject a review for an order that does not exist", async () => {
    mockPool(rows([]));

    await expect(
      ReviewModel.create({ order_id: 999, customer_id: 7, rating: 5 })
    ).rejects.toMatchObject({ message: "Order not found", statusCode: 404 });
  });

  it("should reject a review for another customer's order", async () => {
    mockPool(rows([orderRow({ customerId: 99 })]));

    await expect(
      ReviewModel.create({ order_id: 12, customer_id: 7, rating: 5 })
    ).rejects.toMatchObject({ message: "You can only review your own orders", statusCode: 403 });
  });

  it("should reject a review for a cancelled order", async () => {
    mockPool(rows([orderRow({ status: "cancelled" })]));

    await expect(
      ReviewModel.create({ order_id: 12, customer_id: 7, rating: 5 })
    ).rejects.toMatchObject({ message: "A cancelled order cannot be reviewed", statusCode: 400 });
  });

  it("should reject a stall id that does not match the order", async () => {
    mockPool(rows([orderRow()]));

    await expect(
      ReviewModel.create({ order_id: 12, stall_id: 99, customer_id: 7, rating: 5 })
    ).rejects.toMatchObject({ message: "That order has nothing from this stall", statusCode: 400 });
  });

  it("should reject an order with no stall attached", async () => {
    mockPool(rows([orderRow({ stallId: null })]));

    await expect(
      ReviewModel.create({ order_id: 12, customer_id: 7, rating: 5 })
    ).rejects.toMatchObject({
      message: "That order is not linked to a stall, so it cannot be reviewed",
      statusCode: 400
    });
  });

  it("should reject a second review for the same order", async () => {
    mockPool([rows([orderRow()]), rows([{ reviewId: 21 }])]);

    await expect(
      ReviewModel.create({ order_id: 12, stall_id: 3, customer_id: 7, rating: 5 })
    ).rejects.toMatchObject({ message: "You have already reviewed this order", statusCode: 409 });
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(
      ReviewModel.create({ order_id: 12, customer_id: 7, rating: 5 })
    ).rejects.toThrow("Database Error");
  });
});

describe("ReviewModel.findByStall", () => {
  it("should return the stall's reviews", async () => {
    const reviews = [{ review_id: 21, rating: 5 }];
    const { request } = mockPool(rows(reviews));

    const result = await ReviewModel.findByStall(3);

    expect(request.input).toHaveBeenCalledWith("stallId", sql.Int, 3);
    expect(result).toEqual(reviews);
  });

  it("should return an empty list when there are no reviews", async () => {
    mockPool(rows([]));

    await expect(ReviewModel.findByStall(3)).resolves.toEqual([]);
  });
});

describe("ReviewModel.getStallSummary", () => {
  it("should round the average rating to one decimal", async () => {
    mockPool(rows([{ review_count: 3, average_rating: 4.33 }]));

    await expect(ReviewModel.getStallSummary(3)).resolves.toEqual({
      stall_id: 3,
      review_count: 3,
      average_rating: 4.3
    });
  });

  it("should report a null average when the stall has no reviews", async () => {
    mockPool(rows([{ review_count: 0, average_rating: null }]));

    await expect(ReviewModel.getStallSummary(3)).resolves.toEqual({
      stall_id: 3,
      review_count: 0,
      average_rating: null
    });
  });
});

describe("ReviewModel.findByCustomer", () => {
  it("should return every review the customer has written", async () => {
    const reviews = [{ review_id: 21, order_id: 12 }];
    mockPool(rows(reviews));

    await expect(ReviewModel.findByCustomer(7)).resolves.toEqual(reviews);
  });
});

describe("ReviewModel.findByOrderForCustomer", () => {
  it("should scope the lookup to the order and the customer", async () => {
    const { request } = mockPool(rows([{ FeedbackId: 21 }]));

    const result = await ReviewModel.findByOrderForCustomer(12, 7);

    expect(request.input).toHaveBeenCalledWith("orderId", sql.Int, 12);
    expect(request.input).toHaveBeenCalledWith("customerId", sql.Int, 7);
    expect(result).toEqual([{ FeedbackId: 21 }]);
  });

  it("should return an empty list for another customer's order", async () => {
    mockPool(rows([]));

    await expect(ReviewModel.findByOrderForCustomer(12, 99)).resolves.toEqual([]);
  });
});

describe("ReviewModel.updateOwn", () => {
  it("should return true when the customer's own review was updated", async () => {
    mockPool(affected(1));

    await expect(ReviewModel.updateOwn(21, 7, { rating: 4, comment: "Good." })).resolves.toBe(true);
  });

  it("should return false when the review belongs to somebody else", async () => {
    mockPool(affected(0));

    await expect(ReviewModel.updateOwn(21, 99, { rating: 4 })).resolves.toBe(false);
  });

  it("should store a null comment when none was given", async () => {
    const { request } = mockPool(affected(1));

    await ReviewModel.updateOwn(21, 7, { rating: 4 });

    expect(request.input).toHaveBeenCalledWith("comment", undefined, null);
  });
});

describe("ReviewModel.deleteOwn", () => {
  it("should return true when the customer's own review was deleted", async () => {
    mockPool(affected(1));

    await expect(ReviewModel.deleteOwn(21, 7)).resolves.toBe(true);
  });

  it("should return false when the review belongs to somebody else", async () => {
    mockPool(affected(0));

    await expect(ReviewModel.deleteOwn(21, 99)).resolves.toBe(false);
  });
});
