const { generateRentalAgreementText } = require("../models/rentalAgreementTemplates");

function agreementDetails(overrides) {
  return Object.assign(
    {
      ownerName: "operator1",
      renterName: "vendor1",
      centreName: "Maxwell Food Centre",
      unitNumber: "01-23",
      purposeOfUse: "Chicken rice stall",
      rentalPrice: 1500,
      startDate: "2026-01-01",
      endDate: "2026-07-01"
    },
    overrides
  );
}

describe("rentalAgreementTemplates.generateRentalAgreementText", () => {
  it("should name both parties", () => {
    const text = generateRentalAgreementText(agreementDetails());

    expect(text).toContain("operator1, hereinafter referred to as the OWNER");
    expect(text).toContain("vendor1, hereinafter referred to as the RENTER");
  });

  it("should state the centre and unit number", () => {
    const text = generateRentalAgreementText(agreementDetails());

    expect(text).toContain("Maxwell Food Centre");
    expect(text).toContain("Unit 01-23");
  });

  it("should format the rental rate to two decimal places", () => {
    const text = generateRentalAgreementText(agreementDetails({ rentalPrice: 1500 }));

    expect(text).toContain("$1500.00");
  });

  it("should accept a rental price given as a string", () => {
    const text = generateRentalAgreementText(agreementDetails({ rentalPrice: "1234.5" }));

    expect(text).toContain("$1234.50");
  });

  it("should write both dates in long form", () => {
    const text = generateRentalAgreementText(agreementDetails());

    expect(text).toContain("January 1, 2026");
    expect(text).toContain("July 1, 2026");
  });

  it("should fall back to a default purpose of use", () => {
    const text = generateRentalAgreementText(agreementDetails({ purposeOfUse: null }));

    expect(text).toContain("Purpose of Use: Food and beverage stall");
  });

  it("should include the unpaid rent and closure clauses", () => {
    const text = generateRentalAgreementText(agreementDetails());

    expect(text).toContain("DELAYED OR UNPAID RENT POLICY");
    expect(text).toContain("STRICT NO OPERATION POLICY DURING CLOSURE");
    expect(text).toContain("$500.00");
  });
});
