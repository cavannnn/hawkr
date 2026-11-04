process.env.JWT_SECRET = "test-secret";

const authController = require("../controllers/authController");
const sql = require("mssql");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("mssql");
jest.mock("bcrypt");
jest.mock("jsonwebtoken");

describe("authController.login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should issue a token for a valid operator", async () => {
    mockPool(rows([{ OperatorId: 2, Username: "operator1", PasswordHash: "hashed-password" }]));
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("signed-token");

    const req = mockRequest({ body: { username: "operator1", password: "secret123" } });
    const res = mockResponse();

    await authController.login(req, res);

    expect(bcrypt.compare).toHaveBeenCalledWith("secret123", "hashed-password");
    expect(jwt.sign).toHaveBeenCalledWith(
      { OperatorId: 2, Username: "operator1", Role: "Operator" },
      "test-secret",
      { expiresIn: "1h" }
    );
    expect(res.json).toHaveBeenCalledWith({ message: "Login successful", token: "signed-token" });
  });

  it("should respond 400 when the username is missing", async () => {
    const req = mockRequest({ body: { password: "secret123" } });
    const res = mockResponse();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Username and password are required' });
    expect(sql.connect).not.toHaveBeenCalled();
  });

  it("should respond 400 when the password is missing", async () => {
    const req = mockRequest({ body: { username: "operator1" } });
    const res = mockResponse();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(sql.connect).not.toHaveBeenCalled();
  });

  it("should respond 401 when no operator matches the username", async () => {
    mockPool(rows([]));

    const req = mockRequest({ body: { username: "ghost", password: "secret123" } });
    const res = mockResponse();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid username or password" });
  });

  it("should respond 401 when the password does not match", async () => {
    mockPool(rows([{ OperatorId: 2, Username: "operator1", PasswordHash: "hashed-password" }]));
    bcrypt.compare.mockResolvedValue(false);

    const req = mockRequest({ body: { username: "operator1", password: "wrong" } });
    const res = mockResponse();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid username or password" });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it("should respond 500 when the database is unreachable", async () => {
    mockConnectionError("Database Error");

    const req = mockRequest({ body: { username: "operator1", password: "secret123" } });
    const res = mockResponse();

    await authController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Login failed due to server error" });
  });
});
