const {
  validateOrder,
  validateOrderStatus,
  validateCustomerProfile,
  validateQueryParams,
  validateReview,
  validateReviewUpdate,
  validateFavorite,
  validateFavoriteQuery
} = require("../middleware/validate");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

function expectRejected(res, next) {
  expect(res.status).toHaveBeenCalledWith(400);
  expect(next).not.toHaveBeenCalled();
}

describe("validate.validateOrder", () => {
  function orderBody(overrides) {
    return Object.assign(
      {
        stall_id: 3,
        hawker_id: 1,
        customer_name: "Jaslyn",
        customer_phone: "91234567",
        payment_method: "paynow",
        items: [{ menu_id: 1, quantity: 2 }]
      },
      overrides
    );
  }

  it("should accept a complete order", () => {
    const req = mockRequest({ body: orderBody() });
    const res = mockResponse();
    const next = mockNext();

    validateOrder(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject an order with no items", () => {
    const req = mockRequest({ body: orderBody({ items: [] }) });
    const res = mockResponse();
    const next = mockNext();

    validateOrder(req, res, next);

    expectRejected(res, next);
  });

  it("should reject an item with a quantity below one", () => {
    const req = mockRequest({ body: orderBody({ items: [{ menu_id: 1, quantity: 0 }] }) });
    const res = mockResponse();
    const next = mockNext();

    validateOrder(req, res, next);

    expectRejected(res, next);
  });

  it("should reject a phone number that is not 8 to 12 digits", () => {
    const req = mockRequest({ body: orderBody({ customer_phone: "123" }) });
    const res = mockResponse();
    const next = mockNext();

    validateOrder(req, res, next);

    expectRejected(res, next);
  });

  it("should reject an unsupported payment method", () => {
    const req = mockRequest({ body: orderBody({ payment_method: "bitcoin" }) });
    const res = mockResponse();
    const next = mockNext();

    validateOrder(req, res, next);

    expectRejected(res, next);
  });

  it("should reject a round-up over one dollar", () => {
    const req = mockRequest({ body: orderBody({ round_up: 2 }) });
    const res = mockResponse();
    const next = mockNext();

    validateOrder(req, res, next);

    expectRejected(res, next);
  });

  it("should reject an order with no customer name", () => {
    const body = orderBody();
    delete body.customer_name;
    const req = mockRequest({ body });
    const res = mockResponse();
    const next = mockNext();

    validateOrder(req, res, next);

    expectRejected(res, next);
  });
});

describe("validate.validateOrderStatus", () => {
  it("should accept a known status", () => {
    const req = mockRequest({ body: { order_status: "preparing" } });
    const res = mockResponse();
    const next = mockNext();

    validateOrderStatus(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject an unknown status", () => {
    const req = mockRequest({ body: { order_status: "shipped" } });
    const res = mockResponse();
    const next = mockNext();

    validateOrderStatus(req, res, next);

    expectRejected(res, next);
  });

  it("should reject a missing status", () => {
    const req = mockRequest({ body: {} });
    const res = mockResponse();
    const next = mockNext();

    validateOrderStatus(req, res, next);

    expectRejected(res, next);
  });
});

describe("validate.validateCustomerProfile", () => {
  it("should accept a single changed field", () => {
    const req = mockRequest({ body: { phone: "91234567" } });
    const res = mockResponse();
    const next = mockNext();

    validateCustomerProfile(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject an empty body", () => {
    const req = mockRequest({ body: {} });
    const res = mockResponse();
    const next = mockNext();

    validateCustomerProfile(req, res, next);

    expectRejected(res, next);
  });

  it("should reject an invalid email", () => {
    const req = mockRequest({ body: { email: "not-an-email" } });
    const res = mockResponse();
    const next = mockNext();

    validateCustomerProfile(req, res, next);

    expectRejected(res, next);
  });
});

describe("validate.validateQueryParams", () => {
  it("should accept the supported filters", () => {
    const req = mockRequest({ query: { hawker_id: "1", stall_id: "3", limit: "20" } });
    const res = mockResponse();
    const next = mockNext();

    validateQueryParams(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a limit over 100", () => {
    const req = mockRequest({ query: { limit: "500" } });
    const res = mockResponse();
    const next = mockNext();

    validateQueryParams(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].message).toBe("Invalid query parameters");
  });

  it("should reject an unknown filter", () => {
    const req = mockRequest({ query: { unknown: "x" } });
    const res = mockResponse();
    const next = mockNext();

    validateQueryParams(req, res, next);

    expectRejected(res, next);
  });
});

describe("validate.validateReview", () => {
  it("should accept a complete review", () => {
    const req = mockRequest({ body: { orderId: 12, stallId: 3, rating: 5, comment: "Very good." } });
    const res = mockResponse();
    const next = mockNext();

    validateReview(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a rating outside 1 to 5", () => {
    const req = mockRequest({ body: { orderId: 12, rating: 9 } });
    const res = mockResponse();
    const next = mockNext();

    validateReview(req, res, next);

    expectRejected(res, next);
  });

  it("should reject a comment longer than 1000 characters", () => {
    const req = mockRequest({ body: { orderId: 12, rating: 5, comment: "x".repeat(1001) } });
    const res = mockResponse();
    const next = mockNext();

    validateReview(req, res, next);

    expectRejected(res, next);
  });

  it("should reject a review with no order", () => {
    const req = mockRequest({ body: { rating: 5 } });
    const res = mockResponse();
    const next = mockNext();

    validateReview(req, res, next);

    expectRejected(res, next);
  });
});

describe("validate.validateReviewUpdate", () => {
  it("should accept a rating and comment", () => {
    const req = mockRequest({ body: { rating: 4, comment: "Still good." } });
    const res = mockResponse();
    const next = mockNext();

    validateReviewUpdate(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject an attempt to move the review to another order", () => {
    const req = mockRequest({ body: { rating: 4, orderId: 99 } });
    const res = mockResponse();
    const next = mockNext();

    validateReviewUpdate(req, res, next);

    expectRejected(res, next);
  });

  it("should reject an attempt to change the author", () => {
    const req = mockRequest({ body: { rating: 4, customer_id: 99 } });
    const res = mockResponse();
    const next = mockNext();

    validateReviewUpdate(req, res, next);

    expectRejected(res, next);
  });
});

describe("validate.validateFavorite", () => {
  it("should accept a centre-level favourite", () => {
    const req = mockRequest({ body: { hawker_id: 1 } });
    const res = mockResponse();
    const next = mockNext();

    validateFavorite(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should accept a null stall and menu id", () => {
    const req = mockRequest({ body: { hawker_id: 1, stall_id: null, menu_id: null } });
    const res = mockResponse();
    const next = mockNext();

    validateFavorite(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a favourite with no hawker id", () => {
    const req = mockRequest({ body: { stall_id: 3 } });
    const res = mockResponse();
    const next = mockNext();

    validateFavorite(req, res, next);

    expectRejected(res, next);
  });
});

describe("validate.validateFavoriteQuery", () => {
  it("should accept a hawker id in the query string", () => {
    const req = mockRequest({ query: { hawker_id: "1" } });
    const res = mockResponse();
    const next = mockNext();

    validateFavoriteQuery(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a query with no hawker id", () => {
    const req = mockRequest({ query: {} });
    const res = mockResponse();
    const next = mockNext();

    validateFavoriteQuery(req, res, next);

    expectRejected(res, next);
  });
});
