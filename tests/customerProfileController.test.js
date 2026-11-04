const CustomerProfileController = require("../controllers/customerProfileController");
const User = require("../models/userModel");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

jest.mock("../models/userModel");

describe("CustomerProfileController.getProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the customer's own profile fields", async () => {
    User.findUserById.mockResolvedValue({
      userId: 7,
      username: "jaslyn",
      email: "jaslyn@mail.com",
      contactNumber: "91234567"
    });

    const req = mockRequest({ params: { userId: "7" } });
    const res = mockResponse();

    await CustomerProfileController.getProfile(req, res, mockNext());

    expect(User.findUserById).toHaveBeenCalledWith(7);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user_id: 7, username: "jaslyn", email: "jaslyn@mail.com", phone: "91234567" }
    });
  });

  it("should respond 404 when the account does not exist", async () => {
    User.findUserById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { userId: "999" } });
    const res = mockResponse();

    await CustomerProfileController.getProfile(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ success: false, message: "User not found" });
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    User.findUserById.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" } });
    const res = mockResponse();
    const next = mockNext();

    await CustomerProfileController.getProfile(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});

describe("CustomerProfileController.updatePhone", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should save a valid phone number", async () => {
    User.findUserById.mockResolvedValue({ userId: 7, username: "jaslyn", email: "jaslyn@mail.com" });
    User.updateContactNumber.mockResolvedValue(true);

    const req = mockRequest({ params: { userId: "7" }, body: { phone: "98765432" } });
    const res = mockResponse();

    await CustomerProfileController.updatePhone(req, res, mockNext());

    expect(User.updateContactNumber).toHaveBeenCalledWith(7, "98765432");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { user_id: 7, username: "jaslyn", email: "jaslyn@mail.com", phone: "98765432" }
    });
  });

  it("should respond 400 when the phone number is too short", async () => {
    const req = mockRequest({ params: { userId: "7" }, body: { phone: "123" } });
    const res = mockResponse();

    await CustomerProfileController.updatePhone(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: "Phone number must be 8 to 12 digits."
    });
    expect(User.updateContactNumber).not.toHaveBeenCalled();
  });

  it("should respond 400 when the phone number is not a string", async () => {
    const req = mockRequest({ params: { userId: "7" }, body: { phone: 91234567 } });
    const res = mockResponse();

    await CustomerProfileController.updatePhone(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(User.updateContactNumber).not.toHaveBeenCalled();
  });

  it("should respond 404 when the account does not exist", async () => {
    User.findUserById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { userId: "999" }, body: { phone: "98765432" } });
    const res = mockResponse();

    await CustomerProfileController.updatePhone(req, res, mockNext());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(User.updateContactNumber).not.toHaveBeenCalled();
  });

  it("should pass a model failure to the error handler", async () => {
    const error = new Error("Database error");
    User.findUserById.mockRejectedValue(error);

    const req = mockRequest({ params: { userId: "7" }, body: { phone: "98765432" } });
    const res = mockResponse();
    const next = mockNext();

    await CustomerProfileController.updatePhone(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
