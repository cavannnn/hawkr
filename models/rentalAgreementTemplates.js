// Generates the legal-style stall rental agreement text shown on a vendor's
// Rental Agreement page, filled in from the details of their approved stall request.

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

function generateRentalAgreementText({ ownerName, renterName, centreName, unitNumber, purposeOfUse, rentalPrice, startDate, endDate }) {
  const start = formatDate(startDate);
  const end = formatDate(endDate);
  const rate = Number(rentalPrice).toFixed(2);

  return `STALL RENTAL AGREEMENT

This Stall Rental Agreement ("Agreement") is entered into this ${start}, by and between:

${ownerName}, hereinafter referred to as the OWNER;

-and-

${renterName}, hereinafter referred to as the RENTER;

Both parties agree to the following terms:

1. SUBJECT OF LEASE
The Owner agrees to lease to the Renter a stall located at: ${centreName}
Stall Location/Number: Unit ${unitNumber}
Purpose of Use: ${purposeOfUse || "Food and beverage stall"}

2. RENTAL RATE
The monthly rental fee shall be $${rate}, payable on or before the 7th day of each month.

3. TERM OF LEASE
This Agreement begins on ${start} and remains in effect for six (6) months, ending on ${end}, unless renewed by both parties.

4. DELAYED OR UNPAID RENT POLICY
If the Renter fails to pay the rental fee on the due date, the account shall be considered past due and subject to the following rules:
   a. The Renter is only allowed to accumulate a maximum unpaid balance of $500.00.
   b. Once the unpaid balance reaches beyond $500.00, the stall shall be automatically and immediately CLOSED by the Owner.
   c. The stall shall remain closed and inoperative until the full payment of all outstanding balances has been completely settled.
   d. The Renter waives any claim for loss of income, damages, or business interruption resulting from the stall's closure due to non-payment.

5. STRICT NO OPERATION POLICY DURING CLOSURE
During the period of closure:
   - The Renter is strictly prohibited from operating, selling, or transacting business in the stall.
   - Any violation shall be a ground for immediate termination of contract.`;
}

module.exports = { generateRentalAgreementText };
