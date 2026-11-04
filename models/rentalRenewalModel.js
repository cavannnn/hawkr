const sql = require("mssql");
const { generateRentalAgreementText } = require("./rentalAgreementTemplates");
const { createNotification } = require("./notificationModel");

// check if there already is an open renewal request for this agreement
async function hasPendingRenewal(agreementId) {
  const result = await sql.query`
    SELECT RenewalRequestId FROM RentalRenewalRequests
    WHERE AgreementId = ${agreementId} AND Status = 'pending'
  `;
  return result.recordset.length > 0;
}

async function createRenewalRequest(agreementId, stallId, vendorId) {
  await sql.query`
    INSERT INTO RentalRenewalRequests (AgreementId, StallId, VendorId)
    VALUES (${agreementId}, ${stallId}, ${vendorId})
  `;
}

// Pending requests, joined with everything an operator needs to review them
async function getPendingRenewalRequests() {
  const result = await sql.query`
    SELECT rr.RenewalRequestId, rr.AgreementId, rr.StallId, rr.VendorId, rr.RequestedAt,
           s.stallName, c.centreName, u.username AS vendorName,
           ra.RentalPrice AS currentRentalPrice, ra.AgreementEndDate AS currentEndDate
    FROM RentalRenewalRequests rr
    JOIN Stalls s ON s.stallId = rr.StallId
    JOIN HawkerCentres c ON c.centreId = s.centreId
    JOIN UserAccounts u ON u.userId = rr.VendorId
    JOIN RentalAgreements ra ON ra.AgreementId = rr.AgreementId
    WHERE rr.Status = 'pending'
    ORDER BY rr.RequestedAt
  `;
  return result.recordset;
}

async function getRenewalRequestById(id) {
  const result = await sql.query`
    SELECT * FROM RentalRenewalRequests WHERE RenewalRequestId = ${id}
  `;
  return result.recordset[0];
}

// Operator approves: creates the "upcoming" agreement (starts the day after the
// current one ends, runs 6 months) at the operator-decided rate, and links it back.
async function approveRenewalRequest(renewalRequestId, operatorId, newRentalPrice) {
  const request = await getRenewalRequestById(renewalRequestId);
  if (!request) return "not found";
  if (request.Status !== "pending") return "already reviewed";

  const agreementResult = await sql.query`SELECT * FROM RentalAgreements WHERE AgreementId = ${request.AgreementId}`;
  const currentAgreement = agreementResult.recordset[0];
  if (!currentAgreement) return "not found";

  const centreResult = await sql.query`
    SELECT c.centreName FROM Stalls s JOIN HawkerCentres c ON c.centreId = s.centreId
    WHERE s.stallId = ${request.StallId}
  `;
  const operatorResult = await sql.query`SELECT username FROM UserAccounts WHERE userId = ${operatorId}`;
  const vendorResult = await sql.query`SELECT username FROM UserAccounts WHERE userId = ${request.VendorId}`;
  const stallResult = await sql.query`SELECT stallName, unitNumber FROM Stalls WHERE stallId = ${request.StallId}`;

  const operatorName = operatorResult.recordset[0] ? operatorResult.recordset[0].username : "Hawker Centre Management";

  const newStart = new Date(currentAgreement.AgreementEndDate);
  newStart.setDate(newStart.getDate() + 1);
  const newEnd = new Date(newStart);
  newEnd.setMonth(newEnd.getMonth() + 6);

  const agreementText = generateRentalAgreementText({
    ownerName: operatorName,
    renterName: vendorResult.recordset[0] ? vendorResult.recordset[0].username : stallResult.recordset[0].stallName,
    centreName: centreResult.recordset[0] ? centreResult.recordset[0].centreName : "",
    unitNumber: stallResult.recordset[0].unitNumber,
    purposeOfUse: null,
    rentalPrice: newRentalPrice,
    startDate: newStart,
    endDate: newEnd
  });

  const inserted = await sql.query`
    INSERT INTO RentalAgreements
      (StallId, OwnerId, AgreementStartDate, AgreementEndDate, AgreementTermsAndConditions, RentalPrice, ContractType, ContractName)
    VALUES
      (${request.StallId}, ${operatorId}, ${newStart}, ${newEnd}, ${agreementText}, ${newRentalPrice}, 'Fixed Price', ${operatorName});
    SELECT SCOPE_IDENTITY() AS AgreementId;
  `;
  const newAgreementId = inserted.recordset[0].AgreementId;

  await sql.query`
    UPDATE RentalRenewalRequests
    SET Status = 'approved', ReviewedBy = ${operatorId}, ReviewedAt = GETDATE(),
        ProposedRentalPrice = ${newRentalPrice}, NewAgreementId = ${newAgreementId}
    WHERE RenewalRequestId = ${renewalRequestId}
  `;

  await createNotification(
    request.VendorId, "rental_renewal_approved",
    "Rental renewal approved",
    `Your renewal for ${stallResult.recordset[0].stallName} was approved at $${Number(newRentalPrice).toFixed(2)}/month, starting ${newStart.toLocaleDateString()}.`,
    `storeRental.html?stallId=${request.StallId}`,
    "rentalAgreement", newAgreementId
  );

  return "ok";
}

async function rejectRenewalRequest(renewalRequestId, operatorId, reviewNote) {
  const request = await getRenewalRequestById(renewalRequestId);
  if (!request) return "not found";
  if (request.Status !== "pending") return "already reviewed";

  await sql.query`
    UPDATE RentalRenewalRequests
    SET Status = 'rejected', ReviewedBy = ${operatorId}, ReviewedAt = GETDATE(), ReviewNote = ${reviewNote}
    WHERE RenewalRequestId = ${renewalRequestId}
  `;

  const stallResult = await sql.query`SELECT stallName FROM Stalls WHERE stallId = ${request.StallId}`;
  await createNotification(
    request.VendorId, "rental_renewal_rejected",
    "Rental renewal rejected",
    `Your renewal request for ${stallResult.recordset[0].stallName} was rejected.${reviewNote ? " Reason: " + reviewNote : ""}`,
    `storeRental.html?stallId=${request.StallId}`,
    "rentalAgreement", request.AgreementId
  );

  return "ok";
}

module.exports = {
  hasPendingRenewal,
  createRenewalRequest,
  getPendingRenewalRequests,
  getRenewalRequestById,
  approveRenewalRequest,
  rejectRenewalRequest
};
