const GRADE_YEARS = { A: 3, B: 1 };

const DECLARABLE_GRADES = ["A", "B"];

function getYearsDifference(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let years = end.getFullYear() - start.getFullYear();
    const monthDiff = end.getMonth() - start.getMonth();
    const dayDiff = end.getDate() - start.getDate();

    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
        years--;
    }
    return years;
}

function baseGrade(performanceStartDate, asOfDate) {
    const years = getYearsDifference(performanceStartDate, asOfDate);
    if (years >= GRADE_YEARS.A) return 'A';
    if (years >= GRADE_YEARS.B) return 'B';
    return 'NEW';
}

function performanceStartDateForGrade(declaredGrade, from = new Date()) {
    const start = new Date(from);
    const years = GRADE_YEARS[declaredGrade];
    if (!years) return start;
    start.setFullYear(start.getFullYear() - years);
    start.setDate(start.getDate() - 1);
    return start;
}

function pendingGradeFor(stall, asOfDate = new Date()) {
    if (!stall || !stall.performanceStartDate) return null;
    const assigned = stall.neaGrade != null ? stall.neaGrade : stall.currentGrade;
    if (assigned && assigned !== 'NEW') return null;
    const grade = baseGrade(stall.performanceStartDate, asOfDate);
    return grade === 'NEW' ? null : grade;
}

module.exports = {
    GRADE_YEARS,
    DECLARABLE_GRADES,
    getYearsDifference,
    baseGrade,
    performanceStartDateForGrade,
    pendingGradeFor
};
