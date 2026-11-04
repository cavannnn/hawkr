process.env.JWT_SECRET = "test-secret";

const userController = require("../controllers/userController");
const User = require("../models/userModel");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/userModel");
jest.mock("bcryptjs");
jest.mock("jsonwebtoken");

describe("userController.register", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should hash the password and create the account", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    User.createUser.mockResolvedValue(true);

    const req = mockRequest({
      body: { username: "jaslyn", password: "secret123", email: "jaslyn@mail.com", role: "customer", phone: "91234567" }
    });
    const res = mockResponse();

    await userController.register(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith("secret123", 10);
    expect(User.createUser).toHaveBeenCalledWith("jaslyn", "hashed-password", "jaslyn@mail.com", "customer", "91234567");
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "User registered successfully" });
  });

  it("should allow registration without a phone number", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    User.createUser.mockResolvedValue(true);

    const req = mockRequest({
      body: { username: "jaslyn", password: "secret123", email: "jaslyn@mail.com", role: "customer" }
    });
    const res = mockResponse();

    await userController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("should respond 400 for a phone number that is not 8 to 12 digits", async () => {
    const req = mockRequest({
      body: { username: "jaslyn", password: "secret123", email: "jaslyn@mail.com", role: "customer", phone: "123" }
    });
    const res = mockResponse();

    await userController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Phone number must be 8 to 12 digits." });
    expect(User.createUser).not.toHaveBeenCalled();
  });

  it("should respond 400 when the account could not be created", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    User.createUser.mockResolvedValue(false);

    const req = mockRequest({
      body: { username: "jaslyn", password: "secret123", email: "jaslyn@mail.com", role: "customer" }
    });
    const res = mockResponse();

    await userController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Registration failed" });
  });

  it("should respond 500 when the database call fails", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    User.createUser.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({
      body: { username: "jaslyn", password: "secret123", email: "jaslyn@mail.com", role: "customer" }
    });
    const res = mockResponse();

    await userController.register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("userController.login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return a signed token for valid credentials", async () => {
    User.findUserByUsername.mockResolvedValue({
      userId: 7,
      username: "jaslyn",
      role: "customer",
      passwordHash: "hashed-password"
    });
    bcrypt.compare.mockResolvedValue(true);
    jwt.sign.mockReturnValue("signed-token");

    const req = mockRequest({ body: { username: "jaslyn", password: "secret123" } });
    const res = mockResponse();

    await userController.login(req, res);

    expect(bcrypt.compare).toHaveBeenCalledWith("secret123", "hashed-password");
    expect(jwt.sign).toHaveBeenCalledWith({ id: 7, role: "customer" }, "test-secret", { expiresIn: "1h" });
    expect(res.json).toHaveBeenCalledWith({
      token: "signed-token",
      role: "customer",
      userId: 7,
      username: "jaslyn"
    });
  });

  it("should respond 404 when the account does not exist", async () => {
    User.findUserByUsername.mockResolvedValue(undefined);

    const req = mockRequest({ body: { username: "nobody", password: "secret123" } });
    const res = mockResponse();

    await userController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "User not found" });
  });

  it("should respond 401 when the password does not match", async () => {
    User.findUserByUsername.mockResolvedValue({ userId: 7, role: "customer", passwordHash: "hashed-password" });
    bcrypt.compare.mockResolvedValue(false);

    const req = mockRequest({ body: { username: "jaslyn", password: "wrong" } });
    const res = mockResponse();

    await userController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid credentials" });
    expect(jwt.sign).not.toHaveBeenCalled();
  });

  it("should respond 500 when the lookup fails", async () => {
    User.findUserByUsername.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ body: { username: "jaslyn", password: "secret123" } });
    const res = mockResponse();

    await userController.login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("userController.guestLogin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should issue a short-lived guest token", async () => {
    jwt.sign.mockReturnValue("guest-token");

    const req = mockRequest();
    const res = mockResponse();

    await userController.guestLogin(req, res);

    expect(jwt.sign).toHaveBeenCalledWith({ id: "guest", role: "guest" }, "test-secret", { expiresIn: "30m" });
    expect(res.json).toHaveBeenCalledWith({ token: "guest-token", role: "guest" });
  });
});
