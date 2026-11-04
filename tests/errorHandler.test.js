const { errorHandler, notFoundHandler } = require("../middleware/errorHandler");
const { authenticateToken, authorize } = require("../middleware/auth");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "error").mockImplementation(() => {});
  delete process.env.NODE_ENV;
});

afterEach(() => {
  console.error.mockRestore();
});

describe("errorHandler.errorHandler", () => {
  it("should map a database error to a 500", () => {
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(new Error("Database error occurred"), req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("Database error occurred");
  });

  it("should map a not-found message to a 404", () => {
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(new Error("Stall not found"), req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Stall not found" });
  });

  it("should map a driver error code to a 500", () => {
    const error = new Error("Connection lost");
    error.code = "ECONNCLOSED";
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(error, req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("Database error occurred");
  });

  it("should honour a status carried by the error", () => {
    const error = new Error("Nope");
    error.status = 418;
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(error, req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(418);
  });

  it("should fall back to a 500 with a generic message", () => {
    const req = mockRequest();
    const res = mockResponse();

    errorHandler({}, req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].message).toBe("Something went wrong!");
  });

  it("should hide the stack outside development", () => {
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(new Error("Boom"), req, res, mockNext());

    expect(res.json.mock.calls[0][0].error).toBeUndefined();
  });

  it("should include the stack in development", () => {
    process.env.NODE_ENV = "development";
    const req = mockRequest();
    const res = mockResponse();

    errorHandler(new Error("Boom"), req, res, mockNext());

    expect(res.json.mock.calls[0][0].error).toBeDefined();
  });
});

describe("errorHandler.notFoundHandler", () => {
  it("should respond 404 naming the requested path", () => {
    const req = mockRequest({ originalUrl: "/api/nowhere" });
    const res = mockResponse();

    notFoundHandler(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Route /api/nowhere not found"
    });
  });
});

describe("auth.authenticateToken", () => {
  it("should leave the user null when no token is sent", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    authenticateToken(req, res, next);

    expect(req.user).toBeNull();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should attach a user when a token is sent", () => {
    const req = mockRequest({ headers: { authorization: "Bearer any-token" } });
    const res = mockResponse();
    const next = mockNext();

    authenticateToken(req, res, next);

    expect(req.user).toEqual({ id: 1, role: "customer" });
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("auth.authorize", () => {
  it("should let anybody through when no roles are listed", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    authorize()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should respond 401 when there is no user", () => {
    const req = mockRequest({ user: null });
    const res = mockResponse();
    const next = mockNext();

    authorize(["customer"])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Authentication required" });
  });

  it("should let a listed role through", () => {
    const req = mockRequest({ user: { role: "customer" } });
    const res = mockResponse();
    const next = mockNext();

    authorize(["customer", "vendor"])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should respond 403 for a role outside the list", () => {
    const req = mockRequest({ user: { role: "operator" } });
    const res = mockResponse();
    const next = mockNext();

    authorize(["customer"])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "Insufficient permissions" });
  });
});
