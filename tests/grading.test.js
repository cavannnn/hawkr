const {
  GRADE_YEARS,
  DECLARABLE_GRADES,
  getYearsDifference,
  baseGrade,
  performanceStartDateForGrade,
  pendingGradeFor
} = require("../utils/grading");

describe("grading constants", () => {
  it("should require 3 years for an A and 1 year for a B", () => {
    expect(GRADE_YEARS).toEqual({ A: 3, B: 1 });
  });

  it("should only let a vendor declare an A or a B", () => {
    expect(DECLARABLE_GRADES).toEqual(["A", "B"]);
  });
});

describe("grading.getYearsDifference", () => {
  it("should count whole years between two dates", () => {
    expect(getYearsDifference("2020-01-01", "2023-01-01")).toBe(3);
  });

  it("should not count a year that has not come round yet", () => {
    expect(getYearsDifference("2020-06-01", "2023-05-31")).toBe(2);
  });

  it("should not count a year one day short", () => {
    expect(getYearsDifference("2020-06-15", "2023-06-14")).toBe(2);
  });

  it("should count the year on its anniversary", () => {
    expect(getYearsDifference("2020-06-15", "2023-06-15")).toBe(3);
  });

  it("should return zero within the first year", () => {
    expect(getYearsDifference("2026-01-01", "2026-06-01")).toBe(0);
  });
});

describe("grading.baseGrade", () => {
  it("should give an A after three clean years", () => {
    expect(baseGrade("2020-01-01", "2023-01-01")).toBe("A");
  });

  it("should give a B after one clean year", () => {
    expect(baseGrade("2022-01-01", "2023-06-01")).toBe("B");
  });

  it("should give NEW inside the first year", () => {
    expect(baseGrade("2026-01-01", "2026-06-01")).toBe("NEW");
  });

  it("should still give an A well beyond three years", () => {
    expect(baseGrade("2010-01-01", "2026-01-01")).toBe("A");
  });
});

describe("grading.performanceStartDateForGrade", () => {
  it("should back-date a declared A by just over three years", () => {
    const start = performanceStartDateForGrade("A", new Date("2026-06-15"));

    expect(baseGrade(start, new Date("2026-06-15"))).toBe("A");
  });

  it("should back-date a declared B by just over one year", () => {
    const start = performanceStartDateForGrade("B", new Date("2026-06-15"));

    expect(baseGrade(start, new Date("2026-06-15"))).toBe("B");
  });

  it("should start today for an undeclared grade", () => {
    const from = new Date("2026-06-15");
    const start = performanceStartDateForGrade(null, from);

    expect(start.toISOString().slice(0, 10)).toBe("2026-06-15");
  });
});

describe("grading.pendingGradeFor", () => {
  it("should return null when there is no stall", () => {
    expect(pendingGradeFor(null)).toBeNull();
  });

  it("should return null when the stall has no performance start date", () => {
    expect(pendingGradeFor({ neaGrade: "NEW" })).toBeNull();
  });

  it("should return null when an officer has already assigned a grade", () => {
    expect(
      pendingGradeFor({ neaGrade: "A", performanceStartDate: "2020-01-01" }, new Date("2026-01-01"))
    ).toBeNull();
  });

  it("should surface the earned grade while the stall is still NEW", () => {
    expect(
      pendingGradeFor({ neaGrade: "NEW", performanceStartDate: "2020-01-01" }, new Date("2026-01-01"))
    ).toBe("A");
  });

  it("should read currentGrade when neaGrade is absent", () => {
    expect(
      pendingGradeFor({ currentGrade: "NEW", performanceStartDate: "2024-01-01" }, new Date("2026-01-01"))
    ).toBe("B");
  });

  it("should return null when the stall has not earned anything yet", () => {
    expect(
      pendingGradeFor({ neaGrade: "NEW", performanceStartDate: "2026-01-01" }, new Date("2026-06-01"))
    ).toBeNull();
  });
});
