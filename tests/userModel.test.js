const User = require("../models/userModel");
const sql = require("mssql");
const { mockTaggedQuery, rows, affected } = require("./helpers/dbMock");

jest.mock("mssql");

describe("User.createUser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when the account row is inserted", async () => {
    mockTaggedQuery(affected(1));

    const created = await User.createUser("jaslyn", "hashed", "jaslyn@mail.com", "customer", "91234567");

    expect(sql.query).toHaveBeenCalledTimes(1);
    expect(created).toBe(true);
  });

  it("should return false when no row is inserted", async () => {
    mockTaggedQuery(affected(0));

    const created = await User.createUser("jaslyn", "hashed", "jaslyn@mail.com", "customer", null);

    expect(created).toBe(false);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database error"));

    await expect(
      User.createUser("jaslyn", "hashed", "jaslyn@mail.com", "customer", "91234567")
    ).rejects.toThrow("Database error");
  });
});

describe("User.findUserByUsername", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the matching account", async () => {
    const account = { userId: 7, username: "jaslyn", role: "customer", passwordHash: "hashed" };
    mockTaggedQuery(rows([account]));

    const found = await User.findUserByUsername("jaslyn");

    expect(found).toEqual(account);
  });

  it("should return undefined when no account matches", async () => {
    mockTaggedQuery(rows([]));

    const found = await User.findUserByUsername("nobody");

    expect(found).toBeUndefined();
  });
});

describe("User.findUserById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the account without its password hash", async () => {
    const account = {
      userId: 7,
      username: "jaslyn",
      email: "jaslyn@mail.com",
      role: "customer",
      contactNumber: "91234567"
    };
    mockTaggedQuery(rows([account]));

    const found = await User.findUserById(7);

    expect(found).toEqual(account);
    expect(found.passwordHash).toBeUndefined();
  });

  it("should return undefined for an unknown id", async () => {
    mockTaggedQuery(rows([]));

    await expect(User.findUserById(999)).resolves.toBeUndefined();
  });
});

describe("User.updateContactNumber", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return true when the phone number is updated", async () => {
    mockTaggedQuery(affected(1));

    await expect(User.updateContactNumber(7, "98765432")).resolves.toBe(true);
  });

  it("should return false when no account was updated", async () => {
    mockTaggedQuery(affected(0));

    await expect(User.updateContactNumber(999, "98765432")).resolves.toBe(false);
  });

  it("should propagate a database error", async () => {
    mockTaggedQuery(new Error("Database Error"));

    await expect(User.updateContactNumber(7, "98765432")).rejects.toThrow("Database Error");
  });
});
