const vendorController = require("../controllers/vendorController");
const sql = require("mssql");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const { mockTaggedQuery, rows } = require("./helpers/dbMock");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("mssql");
jest.mock("bcryptjs");
jest.mock("fs");

describe("vendorController.getVendorProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the vendor's profile", async () => {
    const profile = { UserId: 5, UserName: "vendor1", Email: "vendor1@mail.com", Role: "vendor" };
    mockTaggedQuery(rows([profile]));

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await vendorController.getVendorProfile(req, res);

    expect(res.json).toHaveBeenCalledWith(profile);
  });

  it("should respond 404 when no vendor matches", async () => {
    mockTaggedQuery(rows([]));

    const req = mockRequest({ params: { id: "999" } });
    const res = mockResponse();

    await vendorController.getVendorProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Vendor not found" });
  });

  it("should respond 500 when the lookup fails", async () => {
    mockTaggedQuery(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await vendorController.getVendorProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("vendorController.updateVendorProfile", () => {
  function stubRequest(result) {
    const request = {
      input: jest.fn(function () {
        return request;
      }),
      query: jest.fn().mockImplementation(() =>
        result instanceof Error ? Promise.reject(result) : Promise.resolve(result)
      )
    };
    sql.Request.mockImplementation(() => request);
    return request;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should update the text fields without touching the password", async () => {
    const request = stubRequest(rows([]));

    const req = mockRequest({
      params: { id: "5" },
      body: { email: "new@mail.com", contactNumber: "91234567", gender: "F" }
    });
    const res = mockResponse();

    await vendorController.updateVendorProfile(req, res);

    expect(bcrypt.hash).not.toHaveBeenCalled();
    expect(request.query.mock.calls[0][0]).not.toContain("PasswordHash");
    expect(res.json).toHaveBeenCalledWith({ message: "Profile updated successfully" });
  });

  it("should hash and store a new password when one is supplied", async () => {
    bcrypt.hash.mockResolvedValue("hashed-password");
    const request = stubRequest(rows([]));

    const req = mockRequest({
      params: { id: "5" },
      body: { email: "new@mail.com", password: "secret123" }
    });
    const res = mockResponse();

    await vendorController.updateVendorProfile(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith("secret123", 10);
    expect(request.input).toHaveBeenCalledWith("passwordHash", expect.any(Function), "hashed-password");
    expect(request.query.mock.calls[0][0]).toContain("PasswordHash = @passwordHash");
  });

  it("should respond 500 when the update fails", async () => {
    stubRequest(new Error("Database error"));

    const req = mockRequest({ params: { id: "5" }, body: { email: "new@mail.com" } });
    const res = mockResponse();

    await vendorController.updateVendorProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Database error" });
  });
});

describe("vendorController.uploadProfilePicture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
    fs.unlink.mockImplementation((path, cb) => cb && cb());
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should store the new picture and remove the old file", async () => {
    mockTaggedQuery([rows([{ ProfilePicture: "/uploads/avatars/old.png" }]), rows([])]);

    const req = mockRequest({
      params: { id: "5" },
      file: { filename: "new.png", path: "/tmp/new.png" }
    });
    const res = mockResponse();

    await vendorController.uploadProfilePicture(req, res);

    expect(res.json).toHaveBeenCalledWith({
      message: "Profile picture updated successfully",
      profilePicture: "/uploads/avatars/new.png"
    });
    expect(fs.unlink).toHaveBeenCalled();
  });

  it("should respond 400 when no file was uploaded", async () => {
    const req = mockRequest({ params: { id: "5" } });
    const res = mockResponse();

    await vendorController.uploadProfilePicture(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "No image file was uploaded." });
  });

  it("should respond 404 and discard the upload when the vendor does not exist", async () => {
    mockTaggedQuery(rows([]));

    const req = mockRequest({
      params: { id: "999" },
      file: { filename: "new.png", path: "/tmp/new.png" }
    });
    const res = mockResponse();

    await vendorController.uploadProfilePicture(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(fs.unlink).toHaveBeenCalledWith("/tmp/new.png", expect.any(Function));
  });

  it("should respond 500 and discard the upload when the update fails", async () => {
    mockTaggedQuery(new Error("Database error"));

    const req = mockRequest({
      params: { id: "5" },
      file: { filename: "new.png", path: "/tmp/new.png" }
    });
    const res = mockResponse();

    await vendorController.uploadProfilePicture(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(fs.unlink).toHaveBeenCalledWith("/tmp/new.png", expect.any(Function));
  });
});
