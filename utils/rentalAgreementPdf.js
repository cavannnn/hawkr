const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const SVGtoPDF = require("svg-to-pdfkit");

const INK = "#0d1420";
const MUTED = "#5b6472";

// The HAWKR wordmark (public/images/hawkrOS.svg), used everywhere else in the app.
const LOGO_SVG = fs.readFileSync(path.join(__dirname, "..", "public", "images", "hawkrOS.svg"), "utf8");
const LOGO_ASPECT_RATIO = 25 / 168; // hawkrOS.svg's own viewBox is 168x25

function money(value) {
  return "$" + Number(value || 0).toFixed(2);
}

function formatDate(value) {
  return new Date(value).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
}

function drawLogo(doc, x, y, width) {
  SVGtoPDF(doc, LOGO_SVG, x, y, { width, height: width * LOGO_ASPECT_RATIO });
}

// A numbered, all-caps section heading, e.g. "1. SUBJECT OF LEASE"
const SECTION_HEADER_RE = /^\d+\.\s+[A-Z][A-Z\s()/,-]*$/;

function drawTermsBody(doc, text) {
  const lines = (text || "").split("\n");

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();

    if (trimmed === "STALL RENTAL AGREEMENT") continue;
    if (trimmed === "") {
      doc.moveDown(0.6);
      continue;
    }

    if (SECTION_HEADER_RE.test(trimmed)) {
      doc.moveDown(0.35);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(INK).text(trimmed);
      doc.moveDown(0.15);
    } else {
      doc.font("Helvetica").fontSize(10).fillColor("#1a1a1a").text(rawLine);
    }
  }
}

function drawFooter(doc, pageNumber, pageCount, agreement) {
  const bottom = doc.page.height - 44;


  const originalBottomMargin = doc.page.margins.bottom;
  doc.page.margins.bottom = 0;

  doc.save();
  doc.moveTo(50, bottom - 10).lineTo(doc.page.width - 50, bottom - 10).strokeColor("#e2dccd").stroke();
  doc.font("Helvetica").fontSize(8).fillColor(MUTED);
  doc.text(`© ${new Date().getFullYear()} Hawker Management System. All rights reserved.`, 50, bottom, { width: 300, align: "left", lineBreak: false });
  doc.text(`Agreement #${agreement.AgreementId} · Page ${pageNumber} of ${pageCount}`, doc.page.width - 250, bottom, { width: 200, align: "right", lineBreak: false });
  doc.restore();

  doc.page.margins.bottom = originalBottomMargin;
}

// Streams a formatted PDF of one rental agreement straight to the response.
function streamAgreementPdf(res, agreement, stallName) {
  const filename = `rental-agreement-${agreement.AgreementId}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  doc.pipe(res);

  // ---------- Letterhead ----------
  const logoWidth = 110;
  drawLogo(doc, 50, 46, logoWidth);
  doc.font("Helvetica-Bold").fontSize(8).fillColor(MUTED)
    .text("MANAGEMENT SYSTEM", 50, 46 + logoWidth * LOGO_ASPECT_RATIO + 4, { characterSpacing: 1.2 });

  doc.font("Helvetica").fontSize(9).fillColor(MUTED)
    .text(`Agreement #${agreement.AgreementId}`, 0, 50, { align: "right" })
    .text(`Generated ${formatDate(new Date())}`, { align: "right" });

  doc.moveTo(50, 90).lineTo(doc.page.width - 50, 90).strokeColor("#e2dccd").stroke();

  doc.x = 50;
  doc.y = 108;

  doc.font("Helvetica-Bold").fontSize(17).fillColor(INK).text("STALL RENTAL AGREEMENT", { align: "center" });
  doc.moveDown(1.3);

  // ---------- Key details ----------
  doc.fontSize(10);
  const details = [
    ["Stall", stallName || `Stall #${agreement.StallId}`],
    ["Contract Type", agreement.ContractType || "Fixed Price"],
    ["Contract Name (Approved By)", agreement.ContractName || "—"],
    ["Monthly Rental Price", money(agreement.RentalPrice) + " / month"],
    ["Start Date", formatDate(agreement.AgreementStartDate)],
    ["End Date", formatDate(agreement.AgreementEndDate)]
  ];
  for (const [label, value] of details) {
    doc.font("Helvetica-Bold").fillColor(INK).text(label + ": ", { continued: true })
      .font("Helvetica").fillColor("#1a1a1a").text(value);
  }

  doc.moveDown(1);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor("#cccccc").stroke();
  doc.moveDown(1);

  // ---------- Terms & Conditions ----------
  drawTermsBody(doc, agreement.AgreementTermsAndConditions);

  doc.moveDown(1.2);
  doc.font("Helvetica-Oblique").fontSize(8).fillColor(MUTED)
    .text("This document was generated electronically by the Hawker Management System and is valid without a physical signature.");

  // ---------- Footer on every page ----------
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    drawFooter(doc, i + 1, pageCount, agreement);
  }

  doc.end();
}

module.exports = { streamAgreementPdf };
