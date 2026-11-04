const { validateAllergens } = require("../middleware/allergenValidation");
const { validateCuisines } = require("../middleware/cuisineValidation");
const {
  validateUpdateProfile,
  validateChangePassword,
  validateAssignments
} = require("../middleware/profileValidation");
const {
  validateCreateTicket,
  validateStatusUpdate,
  validateCompleteTicket
} = require("../middleware/ticketValidation");
const {
  validateCreateRentalAgreement,
  validateUpdateRentalAgreement
} = require("../middleware/rentalAgreementValidation");
const {
  validateCreateClosure,
  validateCreatePromotion,
  validateClonePromotion
} = require("../middleware/centreManagementValidation");
const {
  validateInspection,
  validateUpdateSchedule,
  validateAssessment,
  validateNumericParam,
  toLocalDateString
} = require("../middleware/inspectionValidation");
const { mockRequest, mockResponse, mockNext } = require("./helpers/httpMock");

beforeEach(() => {
  jest.clearAllMocks();
});

function run(middleware, payload) {
  const req = mockRequest(payload);
  const res = mockResponse();
  const next = mockNext();
  middleware(req, res, next);
  return { req, res, next };
}

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toLocalDateString(date);
}

describe("allergenValidation.validateAllergens", () => {
  it("should accept standard and custom allergens", () => {
    const { next } = run(validateAllergens, {
      body: { allergens: ["seafood", "nuts"], customAllergens: ["durian"] }
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should accept two empty lists", () => {
    const { next } = run(validateAllergens, { body: { allergens: [], customAllergens: [] } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject an allergen outside the vocabulary", () => {
    const { res, next } = run(validateAllergens, {
      body: { allergens: ["plutonium"], customAllergens: [] }
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("should reject a custom allergen over 50 characters", () => {
    const { res } = run(validateAllergens, {
      body: { allergens: [], customAllergens: ["x".repeat(51)] }
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject a body missing customAllergens", () => {
    const { res } = run(validateAllergens, { body: { allergens: [] } });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("cuisineValidation.validateCuisines", () => {
  it("should accept a palette from the vocabulary", () => {
    const { next } = run(validateCuisines, { body: { cuisines: ["Thai", "Korean"] } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should accept an empty palette", () => {
    const { next } = run(validateCuisines, { body: { cuisines: [] } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a cuisine outside the vocabulary", () => {
    const { res } = run(validateCuisines, { body: { cuisines: ["Martian"] } });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject more than five cuisines", () => {
    const { res } = run(validateCuisines, {
      body: { cuisines: ["Thai", "Korean", "Malay", "Indian", "Chinese", "Japanese"] }
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject the same cuisine twice", () => {
    const { res } = run(validateCuisines, { body: { cuisines: ["Thai", "Thai"] } });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("profileValidation.validateUpdateProfile", () => {
  it("should accept a valid profile", () => {
    const { next } = run(validateUpdateProfile, {
      body: { UserName: "operator1", Email: "op@mail.com", PhoneNumber: "9123 4567" }
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a username under three characters", () => {
    const { res } = run(validateUpdateProfile, { body: { UserName: "op" } });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject an invalid email", () => {
    const { res } = run(validateUpdateProfile, {
      body: { UserName: "operator1", Email: "not-an-email" }
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject a phone number with invalid characters", () => {
    const { res } = run(validateUpdateProfile, {
      body: { UserName: "operator1", PhoneNumber: "abc" }
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Phone number contains invalid characters" });
  });
});

describe("profileValidation.validateChangePassword", () => {
  it("should accept a matching confirmation", () => {
    const { next } = run(validateChangePassword, {
      body: { currentPassword: "old", newPassword: "newsecret1", confirmPassword: "newsecret1" }
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a new password under eight characters", () => {
    const { res } = run(validateChangePassword, {
      body: { currentPassword: "old", newPassword: "short", confirmPassword: "short" }
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "New password must be at least 8 characters" });
  });

  it("should reject a mismatched confirmation", () => {
    const { res } = run(validateChangePassword, {
      body: { currentPassword: "old", newPassword: "newsecret1", confirmPassword: "different1" }
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Passwords do not match" });
  });
});

describe("profileValidation.validateAssignments", () => {
  it("should accept a list of centre ids", () => {
    const { next } = run(validateAssignments, { body: { hawkerIds: [1, 2] } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should accept an empty list", () => {
    const { next } = run(validateAssignments, { body: { hawkerIds: [] } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a non-numeric centre id", () => {
    const { res } = run(validateAssignments, { body: { hawkerIds: ["one"] } });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("ticketValidation.validateCreateTicket", () => {
  function ticketBody(overrides) {
    return Object.assign(
      {
        HawkerId: 1,
        Category: "Cleanliness",
        Subject: "Spill near stall 12",
        Description: "There is a wet patch on the floor."
      },
      overrides
    );
  }

  it("should accept a complete ticket", () => {
    const { next } = run(validateCreateTicket, { body: ticketBody() });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a category outside the list", () => {
    const { res } = run(validateCreateTicket, { body: ticketBody({ Category: "Complaint" }) });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should require free text when the category is Others", () => {
    const { res } = run(validateCreateTicket, { body: ticketBody({ Category: "Others" }) });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should accept Others with free text", () => {
    const { next } = run(validateCreateTicket, {
      body: ticketBody({ Category: "Others", OtherCategoryText: "Lost property" })
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a subject over 150 characters", () => {
    const { res } = run(validateCreateTicket, { body: ticketBody({ Subject: "x".repeat(151) }) });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("ticketValidation.validateStatusUpdate", () => {
  it("should accept an in-flight status", () => {
    const { next } = run(validateStatusUpdate, { body: { Status: "Testing" } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a terminal status", () => {
    const { res } = run(validateStatusUpdate, { body: { Status: "Completed" } });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("ticketValidation.validateCompleteTicket", () => {
  it("should accept a closing outcome with a message", () => {
    const { next } = run(validateCompleteTicket, {
      body: { Outcome: "Completed", Message: "Cleaned up." }
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a closing outcome with no message", () => {
    const { res } = run(validateCompleteTicket, { body: { Outcome: "Completed" } });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject an outcome outside the two allowed", () => {
    const { res } = run(validateCompleteTicket, { body: { Outcome: "Ignored", Message: "No." } });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("rentalAgreementValidation.validateCreateRentalAgreement", () => {
  function agreementBody(overrides) {
    return Object.assign(
      {
        StallId: 3,
        OwnerId: 2,
        AgreementStartDate: "2026-01-01",
        AgreementEndDate: "2026-07-01",
        AgreementTermsAndConditions: "Terms",
        RentalPrice: 1500
      },
      overrides
    );
  }

  it("should accept a complete agreement", () => {
    const { next } = run(validateCreateRentalAgreement, { body: agreementBody() });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject an end date that is not after the start", () => {
    const { res } = run(validateCreateRentalAgreement, {
      body: agreementBody({ AgreementEndDate: "2025-12-01" })
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "AgreementEndDate must be after AgreementStartDate"
    });
  });

  it("should reject a rental price of zero", () => {
    const { res } = run(validateCreateRentalAgreement, { body: agreementBody({ RentalPrice: 0 }) });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("rentalAgreementValidation.validateUpdateRentalAgreement", () => {
  it("should accept a complete update", () => {
    const { next } = run(validateUpdateRentalAgreement, {
      body: {
        AgreementId: 1,
        StallId: 3,
        OwnerId: 2,
        AgreementEndDate: "2027-01-01",
        AgreementTermsAndConditions: "Terms",
        RentalPrice: 1800
      }
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject an update with no agreement id", () => {
    const { res } = run(validateUpdateRentalAgreement, {
      body: { StallId: 3, OwnerId: 2, AgreementEndDate: "2027-01-01", RentalPrice: 1800 }
    });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("centreManagementValidation.validateCreateClosure", () => {
  function closureBody(overrides) {
    return Object.assign(
      {
        HawkerId: 1,
        Reason: "Maintenance",
        StartDateTime: "2026-03-01T08:00:00",
        EndDateTime: "2026-03-02T20:00:00"
      },
      overrides
    );
  }

  it("should accept a valid closure", () => {
    const { next } = run(validateCreateClosure, { body: closureBody() });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a reason outside the list", () => {
    const { res } = run(validateCreateClosure, { body: closureBody({ Reason: "Renovation" }) });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject an end that is not after the start", () => {
    const { res } = run(validateCreateClosure, {
      body: closureBody({ EndDateTime: "2026-02-01T08:00:00" })
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "EndDateTime must be after StartDateTime" });
  });
});

describe("centreManagementValidation.validateCreatePromotion", () => {
  function promotionBody(overrides) {
    return Object.assign(
      {
        HawkerId: 1,
        Name: "Centre Deal",
        DiscountType: "Percentage",
        DiscountValue: 10,
        StartDateTime: "2026-03-01T08:00:00",
        EndDateTime: "2026-03-31T20:00:00",
        stallIds: [3, 6]
      },
      overrides
    );
  }

  it("should accept an explicit stall list", () => {
    const { next } = run(validateCreatePromotion, { body: promotionBody() });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should accept the all target", () => {
    const { next } = run(validateCreatePromotion, { body: promotionBody({ stallIds: "all" }) });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject an unknown discount type", () => {
    const { res } = run(validateCreatePromotion, { body: promotionBody({ DiscountType: "BOGOF" }) });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject a promotion with no target", () => {
    const body = promotionBody();
    delete body.stallIds;
    const { res } = run(validateCreatePromotion, { body });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("centreManagementValidation.validateClonePromotion", () => {
  it("should accept a target centre id", () => {
    const { next } = run(validateClonePromotion, { body: { targetHawkerId: 2 } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a clone with no target", () => {
    const { res } = run(validateClonePromotion, { body: {} });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("inspectionValidation.toLocalDateString", () => {
  it("should format a date as YYYY-MM-DD", () => {
    expect(toLocalDateString(new Date(2026, 8, 1))).toBe("2026-09-01");
  });

  it("should pad single-digit months and days", () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("inspectionValidation.validateInspection", () => {
  it("should accept a stall and a future date", () => {
    const { next } = run(validateInspection, { body: { stallId: 6, date: futureDate(30) } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should accept today's date", () => {
    const { next } = run(validateInspection, { body: { stallId: 6, date: toLocalDateString() } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a date in the past", () => {
    const { res } = run(validateInspection, { body: { stallId: 6, date: "2020-01-01" } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Inspection date cannot be in the past." });
  });

  it("should reject a malformed date", () => {
    const { res } = run(validateInspection, { body: { stallId: 6, date: "01/09/2026" } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Please enter a valid date." });
  });

  it("should reject a missing stall", () => {
    const { res } = run(validateInspection, { body: { date: futureDate(30) } });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Stall is required." });
  });
});

describe("inspectionValidation.validateUpdateSchedule", () => {
  it("should accept a future date", () => {
    const { next } = run(validateUpdateSchedule, { body: { date: futureDate(10) } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a body with no date", () => {
    const { res } = run(validateUpdateSchedule, { body: {} });

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("inspectionValidation.validateAssessment", () => {
  function assessmentBody(overrides) {
    return Object.assign(
      {
        hygieneScore: 5,
        personalHygiene: true,
        foodStorage: true,
        pestControl: true,
        isMajorIssue: false,
        remarks: ""
      },
      overrides
    );
  }

  it("should accept a clean assessment with no remarks", () => {
    const { next } = run(validateAssessment, { body: assessmentBody() });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a hygiene score outside 1 to 5", () => {
    const { res } = run(validateAssessment, { body: assessmentBody({ hygieneScore: 6 }) });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Hygiene score must be at most 5." });
  });

  it("should require remarks when a major issue is flagged", () => {
    const body = assessmentBody({ isMajorIssue: true });
    delete body.remarks;
    const { res } = run(validateAssessment, { body });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "Remarks are required when major issues are found."
    });
  });

  it("should accept a major issue with remarks", () => {
    const { next } = run(validateAssessment, {
      body: assessmentBody({ isMajorIssue: true, remarks: "Pests found near the prep area." })
    });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject remarks over 1000 characters", () => {
    const { res } = run(validateAssessment, { body: assessmentBody({ remarks: "x".repeat(1001) }) });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject a missing checklist flag", () => {
    const body = assessmentBody();
    delete body.pestControl;
    const { res } = run(validateAssessment, { body });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Pest control assessment is required." });
  });
});

describe("inspectionValidation.validateNumericParam", () => {
  it("should accept a positive integer", () => {
    const { next } = run(validateNumericParam("stallId", "stall id"), { params: { stallId: "6" } });

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("should reject a non-numeric value", () => {
    const { res } = run(validateNumericParam("stallId", "stall id"), {
      params: { stallId: "unassigned" }
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid stall id." });
  });

  it("should reject zero", () => {
    const { res } = run(validateNumericParam("stallId", "stall id"), { params: { stallId: "0" } });

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("should reject a negative value", () => {
    const { res } = run(validateNumericParam("centreId", "hawker centre id"), {
      params: { centreId: "-1" }
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid hawker centre id." });
  });
});
