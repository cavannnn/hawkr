const rentalAgreementController = require("../controllers/rentalAgreementController");
const rentalAgreementModel = require("../models/rentalAgreementModel");
const { streamAgreementPdf } = require("../utils/rentalAgreementPdf");
const { mockRequest, mockResponse } = require("./helpers/httpMock");

jest.mock("../models/rentalAgreementModel");
jest.mock("../utils/rentalAgreementPdf");

describe("rentalAgreementController.getAllRentalAgreements", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return every rental agreement", async () => {
    const agreements = [{ AgreementId: 1, StallId: 3 }];
    rentalAgreementModel.getAllRentalAgreements.mockResolvedValue(agreements);

    const req = mockRequest();
    const res = mockResponse();

    await rentalAgreementController.getAllRentalAgreements(req, res);

    expect(res.json).toHaveBeenCalledWith(agreements);
  });

  it("should respond 500 when the lookup fails", async () => {
    rentalAgreementModel.getAllRentalAgreements.mockRejectedValue(new Error("Database error"));

    const req = mockRequest();
    const res = mockResponse();

    await rentalAgreementController.getAllRentalAgreements(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch rental agreements" });
  });
});

describe("rentalAgreementController.getRentalAgreementById", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should return the requested agreement", async () => {
    const agreement = { AgreementId: 1, StallId: 3 };
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue(agreement);

    const req = mockRequest({ params: { id: "1" } });
    const res = mockResponse();

    await rentalAgreementController.getRentalAgreementById(req, res);

    expect(rentalAgreementModel.getRentalAgreementById).toHaveBeenCalledWith("1");
    expect(res.json).toHaveBeenCalledWith(agreement);
  });

  it("should respond 404 when the agreement does not exist", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" } });
    const res = mockResponse();

    await rentalAgreementController.getRentalAgreementById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Rental agreement not found" });
  });

  it("should respond 500 when the lookup fails", async () => {
    rentalAgreementModel.getRentalAgreementById.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "1" } });
    const res = mockResponse();

    await rentalAgreementController.getRentalAgreementById(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch rental agreement" });
  });
});

describe("rentalAgreementController.downloadAgreementPdf", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should stream the agreement as a PDF", async () => {
    const agreement = { AgreementId: 1, StallId: 3 };
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue(agreement);

    const req = mockRequest({ params: { id: "1" } });
    const res = mockResponse();

    await rentalAgreementController.downloadAgreementPdf(req, res);

    expect(streamAgreementPdf).toHaveBeenCalledWith(res, agreement);
  });

  it("should respond 404 when the agreement does not exist", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" } });
    const res = mockResponse();

    await rentalAgreementController.downloadAgreementPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(streamAgreementPdf).not.toHaveBeenCalled();
  });

  it("should respond 500 when the PDF cannot be generated", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue({ AgreementId: 1 });
    streamAgreementPdf.mockImplementation(() => {
      throw new Error("PDF failed");
    });

    const req = mockRequest({ params: { id: "1" } });
    const res = mockResponse();

    await rentalAgreementController.downloadAgreementPdf(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to generate rental agreement PDF" });
  });
});

describe("rentalAgreementController.createRentalAgreement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should create the agreement and return its new id", async () => {
    rentalAgreementModel.createRentalAgreement.mockResolvedValue(12);

    const body = { StallId: 3, OwnerId: 2, RentalPrice: 1500 };
    const req = mockRequest({ body });
    const res = mockResponse();

    await rentalAgreementController.createRentalAgreement(req, res);

    expect(rentalAgreementModel.createRentalAgreement).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ message: "Rental agreement created", AgreementId: 12 });
  });

  it("should respond 500 when the insert fails", async () => {
    rentalAgreementModel.createRentalAgreement.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ body: {} });
    const res = mockResponse();

    await rentalAgreementController.createRentalAgreement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to create rental agreement" });
  });
});

describe("rentalAgreementController.updateRentalAgreement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should update an existing agreement", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue({ AgreementId: 1 });
    rentalAgreementModel.updateRentalAgreement.mockResolvedValue(undefined);

    const body = { RentalPrice: 1800 };
    const req = mockRequest({ params: { id: "1" }, body });
    const res = mockResponse();

    await rentalAgreementController.updateRentalAgreement(req, res);

    expect(rentalAgreementModel.updateRentalAgreement).toHaveBeenCalledWith("1", body);
    expect(res.json).toHaveBeenCalledWith({ message: "Rental agreement updated" });
  });

  it("should respond 404 when the agreement does not exist", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" }, body: {} });
    const res = mockResponse();

    await rentalAgreementController.updateRentalAgreement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(rentalAgreementModel.updateRentalAgreement).not.toHaveBeenCalled();
  });

  it("should respond 500 when the update fails", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue({ AgreementId: 1 });
    rentalAgreementModel.updateRentalAgreement.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "1" }, body: {} });
    const res = mockResponse();

    await rentalAgreementController.updateRentalAgreement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to update rental agreement" });
  });
});

describe("rentalAgreementController.deleteRentalAgreement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  it("should delete an existing agreement", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue({ AgreementId: 1 });
    rentalAgreementModel.deleteRentalAgreement.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "1" } });
    const res = mockResponse();

    await rentalAgreementController.deleteRentalAgreement(req, res);

    expect(rentalAgreementModel.deleteRentalAgreement).toHaveBeenCalledWith("1");
    expect(res.json).toHaveBeenCalledWith({ message: "Rental agreement deleted" });
  });

  it("should respond 404 when the agreement does not exist", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue(undefined);

    const req = mockRequest({ params: { id: "999" } });
    const res = mockResponse();

    await rentalAgreementController.deleteRentalAgreement(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(rentalAgreementModel.deleteRentalAgreement).not.toHaveBeenCalled();
  });

  it("should respond 500 when the delete fails", async () => {
    rentalAgreementModel.getRentalAgreementById.mockResolvedValue({ AgreementId: 1 });
    rentalAgreementModel.deleteRentalAgreement.mockRejectedValue(new Error("Database error"));

    const req = mockRequest({ params: { id: "1" } });
    const res = mockResponse();

    await rentalAgreementController.deleteRentalAgreement(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Failed to delete rental agreement" });
  });
});
