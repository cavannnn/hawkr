process.env.JWT_SECRET = "test-secret";

const {
  verifyToken,
  attachUser,
  requireRole,
  requireAnyRole,
  requireOwnId,
  getOfficerId
} = require("../middleware/authMiddleware");
const jwt = require("jsonwebtoken");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("jsonwebtoken");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("authMiddleware.verifyToken", () => {
  it("should attach the decoded token and continue", () => {
    jwt.verify.mockReturnValue({ id: 7, role: "customer" });

    const req = mockRequest({ headers: { authorization: "Bearer good-token" } });
    const res = mockResponse();
    const next = mockNext();

    verifyToken(req, res, next);

    expect(jwt.verify).toHaveBeenCalledWith("good-token", "test-secret");
    expect(req.user).toEqual({ id: 7, role: "customer" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should respond 401 when there is no Authorization header", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "No token provided. Please log in." });
    expect(next).not.toHaveBeenCalled();
  });

  it("should respond 401 when the header carries no token", () => {
    const req = mockRequest({ headers: { authorization: "Bearer" } });
    const res = mockResponse();
    const next = mockNext();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Malformed token. Please log in again." });
  });

  it("should respond 403 for an expired token", () => {
    const expired = new Error("jwt expired");
    expired.name = "TokenExpiredError";
    jwt.verify.mockImplementation(() => {
      throw expired;
    });

    const req = mockRequest({ headers: { authorization: "Bearer old-token" } });
    const res = mockResponse();
    const next = mockNext();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Session expired. Please log in again." });
  });

  it("should respond 403 for a tampered token", () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const req = mockRequest({ headers: { authorization: "Bearer bad-token" } });
    const res = mockResponse();
    const next = mockNext();

    verifyToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid token. Please log in again." });
  });
});

describe("authMiddleware.requireRole", () => {
  it("should let a matching role through", () => {
    const req = mockRequest({ user: { role: "vendor" } });
    const res = mockResponse();
    const next = mockNext();

    requireRole("vendor")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should compare roles without regard to case", () => {
    const req = mockRequest({ user: { Role: "Operator" } });
    const res = mockResponse();
    const next = mockNext();

    requireRole("operator")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should respond 403 for the wrong role", () => {
    const req = mockRequest({ user: { role: "customer" } });
    const res = mockResponse();
    const next = mockNext();

    requireRole("vendor")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Access denied. vendor role required." });
    expect(next).not.toHaveBeenCalled();
  });

  it("should respond 403 when the token carries no role", () => {
    const req = mockRequest({ user: {} });
    const res = mockResponse();
    const next = mockNext();

    requireRole("vendor")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe("authMiddleware.requireAnyRole", () => {
  it("should let any listed role through", () => {
    const req = mockRequest({ user: { role: "vendor" } });
    const res = mockResponse();
    const next = mockNext();

    requireAnyRole(["customer", "vendor"])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should respond 403 for a role outside the list", () => {
    const req = mockRequest({ user: { role: "operator" } });
    const res = mockResponse();
    const next = mockNext();

    requireAnyRole(["customer", "vendor"])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Access denied. One of these roles required: customer, vendor."
    });
  });
});

describe("authMiddleware.requireOwnId", () => {
  it("should let a user act on their own id", () => {
    const req = mockRequest({ user: { id: 5 }, params: { id: "5" } });
    const res = mockResponse();
    const next = mockNext();

    requireOwnId("id")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should accept the UserId claim", () => {
    const req = mockRequest({ user: { UserId: 5 }, params: { id: "5" } });
    const res = mockResponse();
    const next = mockNext();

    requireOwnId()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should accept the OperatorId claim", () => {
    const req = mockRequest({ user: { OperatorId: 2 }, params: { id: "2" } });
    const res = mockResponse();
    const next = mockNext();

    requireOwnId()(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should respond 403 when the URL names somebody else", () => {
    const req = mockRequest({ user: { id: 5 }, params: { id: "9" } });
    const res = mockResponse();
    const next = mockNext();

    requireOwnId("id")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Access denied. You can only access your own account."
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should respond 403 when the token carries no id", () => {
    const req = mockRequest({ user: {}, params: { id: "5" } });
    const res = mockResponse();
    const next = mockNext();

    requireOwnId("id")(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("should check the named parameter", () => {
    const req = mockRequest({ user: { id: 7 }, params: { userId: "7" } });
    const res = mockResponse();
    const next = mockNext();

    requireOwnId("userId")(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("authMiddleware.getOfficerId", () => {
  it("should read the userId claim", () => {
    expect(getOfficerId({ user: { userId: 3 } })).toBe(3);
  });

  it("should fall back to the id claim", () => {
    expect(getOfficerId({ user: { id: 3 } })).toBe(3);
  });

  it("should return undefined without a token", () => {
    expect(getOfficerId({})).toBeUndefined();
  });
});

describe("authMiddleware.attachUser", () => {
  it("should attach a valid token and continue", () => {
    jwt.verify.mockReturnValue({ id: 7, role: "customer" });

    const req = mockRequest({ headers: { authorization: "Bearer good-token" } });
    const res = mockResponse();
    const next = mockNext();

    attachUser(req, res, next);

    expect(req.user).toEqual({ id: 7, role: "customer" });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should continue without a user when there is no token", () => {
    const req = mockRequest();
    const res = mockResponse();
    const next = mockNext();

    attachUser(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should continue without a user when the token is unreadable", () => {
    jwt.verify.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const req = mockRequest({ headers: { authorization: "Bearer bad-token" } });
    const res = mockResponse();
    const next = mockNext();

    attachUser(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next).toHaveBeenCalledTimes(1);
  });
});
