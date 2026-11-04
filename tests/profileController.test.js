const profileController = require("../controllers/profileController");
const profileModel = require("../models/profileModel");
const bcrypt = require("bcryptjs");
const fs = require("fs/promises");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/profileModel");
jest.mock("bcryptjs");
jest.mock("fs/promises");

describe("profileController.getProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the signed-in user's profile", async () => {
    const profile = { UserId: 2, UserName: "operator1", Role: "operator" };
    profileModel.getProfileById.mockResolvedValue(profile);

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await profileController.getProfile(req, res);

    expect(profileModel.getProfileById).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith(profile);
  });

  it("should fall back to the UserId claim", async () => {
    profileModel.getProfileById.mockResolvedValue({ UserId: 12 });

    const req = mockRequest({ user: { UserId: 12 } });
    const res = mockResponse();

    await profileController.getProfile(req, res);

    expect(profileModel.getProfileById).toHaveBeenCalledWith(12);
  });

  it("should respond 404 when there is no profile", async () => {
    profileModel.getProfileById.mockResolvedValue(undefined);

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await profileController.getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Profile not found" });
  });

  it("should respond 500 when the lookup fails", async () => {
    profileModel.getProfileById.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await profileController.getProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch profile" });
  });
});

describe("profileController.updateProfile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should save the profile and return the fresh copy", async () => {
    profileModel.isUsernameTaken.mockResolvedValue(false);
    profileModel.isEmailTaken.mockResolvedValue(false);
    profileModel.updateProfile.mockResolvedValue(undefined);
    profileModel.getProfileById.mockResolvedValue({ UserId: 2, UserName: "operator2" });

    const req = mockRequest({
      user: { id: 2 },
      body: { UserName: "operator2", Email: "op2@mail.com", PhoneNumber: "91234567" }
    });
    const res = mockResponse();

    await profileController.updateProfile(req, res);

    expect(profileModel.updateProfile).toHaveBeenCalledWith(2, {
      UserName: "operator2",
      Email: "op2@mail.com",
      PhoneNumber: "91234567"
    });
    expect(res.json).toHaveBeenCalledWith({
      message: "Profile updated",
      profile: { UserId: 2, UserName: "operator2" }
    });
  });

  it("should respond 409 when the username is taken", async () => {
    profileModel.isUsernameTaken.mockResolvedValue(true);

    const req = mockRequest({ user: { id: 2 }, body: { UserName: "taken" } });
    const res = mockResponse();

    await profileController.updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Username already taken" });
    expect(profileModel.updateProfile).not.toHaveBeenCalled();
  });

  it("should respond 409 when the email is already in use", async () => {
    profileModel.isUsernameTaken.mockResolvedValue(false);
    profileModel.isEmailTaken.mockResolvedValue(true);

    const req = mockRequest({ user: { id: 2 }, body: { UserName: "operator2", Email: "taken@mail.com" } });
    const res = mockResponse();

    await profileController.updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Email already in use" });
  });

  it("should respond 500 when the update fails", async () => {
    profileModel.isUsernameTaken.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 2 }, body: { UserName: "operator2" } });
    const res = mockResponse();

    await profileController.updateProfile(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to update profile" });
  });
});

describe("profileController.uploadPhoto", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should write the file and store its path", async () => {
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    profileModel.updateProfilePhoto.mockResolvedValue(undefined);

    const req = mockRequest({
      user: { id: 2 },
      file: { originalname: "me.png", buffer: Buffer.from("image") }
    });
    const res = mockResponse();

    await profileController.uploadPhoto(req, res);

    expect(fs.mkdir).toHaveBeenCalled();
    expect(fs.writeFile).toHaveBeenCalled();
    expect(profileModel.updateProfilePhoto).toHaveBeenCalledWith(2, expect.stringContaining("/uploads/profile-photos/2/"));
    expect(res.json.mock.calls[0][0].message).toBe("Profile photo updated");
  });

  it("should strip path separators and spaces from the file name", async () => {
    fs.mkdir.mockResolvedValue(undefined);
    fs.writeFile.mockResolvedValue(undefined);
    profileModel.updateProfilePhoto.mockResolvedValue(undefined);

    const req = mockRequest({
      user: { id: 2 },
      file: { originalname: "../../evil name.png", buffer: Buffer.from("image") }
    });
    const res = mockResponse();

    await profileController.uploadPhoto(req, res);

    const storedPath = profileModel.updateProfilePhoto.mock.calls[0][1];
    const savedFileName = storedPath.replace("/uploads/profile-photos/2/", "");
    expect(savedFileName).not.toContain("/");
    expect(savedFileName).not.toContain("\\");
    expect(savedFileName).not.toContain(" ");
  });

  it("should respond 400 when no file was uploaded", async () => {
    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await profileController.uploadPhoto(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "No photo file was uploaded" });
  });

  it("should respond 500 when writing the file fails", async () => {
    fs.mkdir.mockRejectedValue(new Error("Disk full"));

    const req = mockRequest({
      user: { id: 2 },
      file: { originalname: "me.png", buffer: Buffer.from("image") }
    });
    const res = mockResponse();

    await profileController.uploadPhoto(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to upload profile photo" });
  });
});

describe("profileController.changePassword", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should replace the stored hash when the current password matches", async () => {
    profileModel.getPasswordHash.mockResolvedValue("old-hash");
    bcrypt.compare.mockResolvedValue(true);
    bcrypt.hash.mockResolvedValue("new-hash");
    profileModel.updatePasswordHash.mockResolvedValue(undefined);

    const req = mockRequest({
      user: { id: 2 },
      body: { currentPassword: "old", newPassword: "new-secret" }
    });
    const res = mockResponse();

    await profileController.changePassword(req, res);

    expect(bcrypt.hash).toHaveBeenCalledWith("new-secret", 10);
    expect(profileModel.updatePasswordHash).toHaveBeenCalledWith(2, "new-hash");
    expect(res.json).toHaveBeenCalledWith({ message: "Password changed successfully" });
  });

  it("should respond 404 when there is no profile", async () => {
    profileModel.getPasswordHash.mockResolvedValue(undefined);

    const req = mockRequest({ user: { id: 2 }, body: { currentPassword: "old", newPassword: "new" } });
    const res = mockResponse();

    await profileController.changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Profile not found" });
  });

  it("should respond 401 when the current password is wrong", async () => {
    profileModel.getPasswordHash.mockResolvedValue("old-hash");
    bcrypt.compare.mockResolvedValue(false);

    const req = mockRequest({ user: { id: 2 }, body: { currentPassword: "wrong", newPassword: "new" } });
    const res = mockResponse();

    await profileController.changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Current password is incorrect" });
    expect(profileModel.updatePasswordHash).not.toHaveBeenCalled();
  });

  it("should respond 500 when the update fails", async () => {
    profileModel.getPasswordHash.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 2 }, body: { currentPassword: "old", newPassword: "new" } });
    const res = mockResponse();

    await profileController.changePassword(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to change password" });
  });
});

describe("profileController.deleteAccount", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should delete the account", async () => {
    profileModel.deleteAccount.mockResolvedValue(undefined);

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await profileController.deleteAccount(req, res);

    expect(profileModel.deleteAccount).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith({ message: "Account deleted" });
  });

  it("should respond 409 when other records still reference the account", async () => {
    const error = new Error("FK violation");
    error.number = 547;
    profileModel.deleteAccount.mockRejectedValue(error);

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await profileController.deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json.mock.calls[0][0].error).toContain("cannot be deleted");
  });

  it("should respond 500 for any other failure", async () => {
    profileModel.deleteAccount.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await profileController.deleteAccount(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to delete account" });
  });
});

describe("profileController hawker centre assignments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should replace the operator's assignment set", async () => {
    profileModel.setAssignedHawkerIds.mockResolvedValue(undefined);

    const req = mockRequest({ user: { id: 2 }, body: { hawkerIds: [1, 2] } });
    const res = mockResponse();

    await profileController.updateAssignments(req, res);

    expect(profileModel.setAssignedHawkerIds).toHaveBeenCalledWith(2, [1, 2]);
    expect(res.json).toHaveBeenCalledWith({
      message: "Hawker centre assignments updated",
      hawkerIds: [1, 2]
    });
  });

  it("should respond 500 when saving assignments fails", async () => {
    profileModel.setAssignedHawkerIds.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 2 }, body: { hawkerIds: [1] } });
    const res = mockResponse();

    await profileController.updateAssignments(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to update hawker centre assignments" });
  });

  it("should list every hawker centre", async () => {
    const centres = [{ HawkerId: 1, Name: "Maxwell Food Centre" }];
    profileModel.getAllHawkerCentres.mockResolvedValue(centres);

    const req = mockRequest();
    const res = mockResponse();

    await profileController.getAllCentres(req, res);

    expect(res.json).toHaveBeenCalledWith(centres);
  });

  it("should respond 500 when listing centres fails", async () => {
    profileModel.getAllHawkerCentres.mockRejectedValue(new Error("Database error"));

    const req = mockRequest();
    const res = mockResponse();

    await profileController.getAllCentres(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch hawker centres" });
  });

  it("should list the operator's own centres", async () => {
    const centres = [{ HawkerId: 1, Name: "Maxwell Food Centre" }];
    profileModel.getAssignedHawkerCentres.mockResolvedValue(centres);

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await profileController.getMyCentres(req, res);

    expect(profileModel.getAssignedHawkerCentres).toHaveBeenCalledWith(2);
    expect(res.json).toHaveBeenCalledWith(centres);
  });

  it("should respond 500 when listing the operator's centres fails", async () => {
    profileModel.getAssignedHawkerCentres.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ user: { id: 2 } });
    const res = mockResponse();

    await profileController.getMyCentres(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch your hawker centres" });
  });
});
