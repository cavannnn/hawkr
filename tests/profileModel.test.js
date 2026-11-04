const profileModel = require("../models/profileModel");
const sql = require("mssql");
const { mockPool, mockConnectionError, rows } = require("./helpers/dbMock");

jest.mock("mssql");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("profileModel.getProfileById", () => {
  it("should return the account's profile fields", async () => {
    const profile = { UserId: 2, UserName: "operator1", Role: "operator" };
    const { request } = mockPool(rows([profile]));

    const result = await profileModel.getProfileById(2);

    expect(request.input).toHaveBeenCalledWith("UserId", sql.Int, 2);
    expect(result).toEqual(profile);
  });

  it("should return undefined for an unknown account", async () => {
    mockPool(rows([]));

    await expect(profileModel.getProfileById(999)).resolves.toBeUndefined();
  });

  it("should propagate a connection error", async () => {
    mockConnectionError("Database Error");

    await expect(profileModel.getProfileById(2)).rejects.toThrow("Database Error");
  });
});

describe("profileModel.getPasswordHash", () => {
  it("should return the stored hash", async () => {
    mockPool(rows([{ PasswordHash: "hashed" }]));

    await expect(profileModel.getPasswordHash(2)).resolves.toBe("hashed");
  });

  it("should return undefined for an unknown account", async () => {
    mockPool(rows([]));

    await expect(profileModel.getPasswordHash(999)).resolves.toBeUndefined();
  });
});

describe("profileModel.isUsernameTaken", () => {
  it("should return true when another account uses the name", async () => {
    const { request } = mockPool(rows([{ ok: 1 }]));

    const taken = await profileModel.isUsernameTaken("operator1", 2);

    expect(request.input).toHaveBeenCalledWith("ExcludeUserId", sql.Int, 2);
    expect(taken).toBe(true);
  });

  it("should return false when the name is free", async () => {
    mockPool(rows([]));

    await expect(profileModel.isUsernameTaken("newname", 2)).resolves.toBe(false);
  });
});

describe("profileModel.isEmailTaken", () => {
  it("should return true when another account uses the email", async () => {
    mockPool(rows([{ ok: 1 }]));

    await expect(profileModel.isEmailTaken("op@mail.com", 2)).resolves.toBe(true);
  });

  it("should treat a missing email as free without querying", async () => {
    await expect(profileModel.isEmailTaken(null, 2)).resolves.toBe(false);
    expect(sql.connect).not.toHaveBeenCalled();
  });
});

describe("profileModel.updateProfile", () => {
  it("should save the supplied fields", async () => {
    const { request } = mockPool(rows([]));

    await profileModel.updateProfile(2, {
      UserName: "operator2",
      Email: "op2@mail.com",
      PhoneNumber: "91234567"
    });

    expect(request.input).toHaveBeenCalledWith("UserName", undefined, "operator2");
    expect(request.query).toHaveBeenCalledTimes(1);
  });

  it("should store nulls for blank optional fields", async () => {
    const { request } = mockPool(rows([]));

    await profileModel.updateProfile(2, { UserName: "operator2" });

    expect(request.input).toHaveBeenCalledWith("Email", undefined, null);
    expect(request.input).toHaveBeenCalledWith("PhoneNumber", undefined, null);
  });
});

describe("profileModel.updateProfilePhoto", () => {
  it("should store the photo path", async () => {
    const { request } = mockPool(rows([]));

    await profileModel.updateProfilePhoto(2, "/uploads/profile-photos/2/me.png");

    expect(request.input).toHaveBeenCalledWith(
      "ProfilePhotoPath",
      undefined,
      "/uploads/profile-photos/2/me.png"
    );
  });
});

describe("profileModel.updatePasswordHash", () => {
  it("should store the new hash", async () => {
    const { request } = mockPool(rows([]));

    await profileModel.updatePasswordHash(2, "new-hash");

    expect(request.input).toHaveBeenCalledWith("PasswordHash", undefined, "new-hash");
  });
});

describe("profileModel.deleteAccount", () => {
  it("should clear the operator's assignments before deleting the account", async () => {
    const { pool, request } = mockPool(rows([]));

    await profileModel.deleteAccount(2);

    expect(pool.request).toHaveBeenCalledTimes(2);
    expect(request.query).toHaveBeenCalledTimes(2);
  });

  it("should propagate a database error", async () => {
    mockPool(new Error("Database Error"));

    await expect(profileModel.deleteAccount(2)).rejects.toThrow("Database Error");
  });
});

describe("profileModel.getAssignedHawkerIds", () => {
  it("should flatten the assignment rows to ids", async () => {
    mockPool(rows([{ HawkerId: 1 }, { HawkerId: 2 }]));

    await expect(profileModel.getAssignedHawkerIds(2)).resolves.toEqual([1, 2]);
  });

  it("should return an empty list when nothing is assigned", async () => {
    mockPool(rows([]));

    await expect(profileModel.getAssignedHawkerIds(2)).resolves.toEqual([]);
  });
});

describe("profileModel.getAssignedHawkerCentres", () => {
  it("should return the assigned centres", async () => {
    const centres = [{ HawkerId: 1, Name: "Maxwell Food Centre" }];
    mockPool(rows(centres));

    await expect(profileModel.getAssignedHawkerCentres(2)).resolves.toEqual(centres);
  });
});

describe("profileModel.getAllHawkerCentres", () => {
  it("should return every active centre", async () => {
    const centres = [{ HawkerId: 1, Name: "Maxwell Food Centre" }];
    mockPool(rows(centres));

    await expect(profileModel.getAllHawkerCentres()).resolves.toEqual(centres);
  });
});

describe("profileModel.setAssignedHawkerIds", () => {
  it("should clear the old set then insert each centre", async () => {
    const { pool } = mockPool(rows([]));

    await profileModel.setAssignedHawkerIds(2, [1, 2]);

    expect(pool.request).toHaveBeenCalledTimes(3);
  });

  it("should only clear when the new set is empty", async () => {
    const { pool } = mockPool(rows([]));

    await profileModel.setAssignedHawkerIds(2, []);

    expect(pool.request).toHaveBeenCalledTimes(1);
  });
});
