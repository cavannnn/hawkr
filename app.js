const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const express = require("express");
const cors = require("cors");
const sql = require("mssql");
const config = require("./dbConfig");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./swagger-output.json");

// Private routes
const userRoutes = require("./routes/userRoutes");
const vendorDashboardRoutes = require("./routes/vendorDashboardRoutes");
const vendorRoutes = require("./routes/vendorRoutes");
const stallRoutes = require("./routes/stallRoutes");
const vendorOrderRoutes = require("./routes/vendorOrderRoutes");
const vendorHeaderRoutes = require("./routes/vendorHeaderRoutes");
const operatorStallRoutes = require("./routes/operatorStallRoutes");

// Public routes (split by table)
const publicUserRoutes = require("./publicRoutes/publicUserRoutes");
const publicVendorDashboardRoutes = require("./publicRoutes/publicVendorDashboardRoutes");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Health check
app.get("/", (req, res) => {
  res.status(200).json({ message: "Hawker API is running" });
});

// Private routes
app.use("/user", userRoutes);
app.use("/vendor", vendorDashboardRoutes);
app.use("/vendor", vendorRoutes);
app.use("/vendor", stallRoutes);
app.use("/vendor", vendorOrderRoutes);
app.use("/vendor", vendorHeaderRoutes);
app.use("/operator", operatorStallRoutes);

// Public routes
app.use("/public/user", publicUserRoutes);
app.use("/public/vendor", publicVendorDashboardRoutes);

// Rental agreements
const rentalAgreementRoutes = require('./routes/rentalAgreementRoutes');
const rentalAgreementHistoryRoutes = require('./routes/rentalAgreementHistoryRoutes');

app.use('/api/rental-agreements', rentalAgreementRoutes);
app.use('/api/rental-agreement-history', rentalAgreementHistoryRoutes);

// Customer module
const customerRoutes = require('./routes/index');
app.use('/api', customerRoutes);

const inspectionRoutes = require('./routes/inspectionRoutes');
app.use(inspectionRoutes);

// Operator profile management + centre management
const profileRoutes = require('./routes/profileRoutes');
const centreManagementRoutes = require('./routes/centreManagementRoutes');
app.use('/api/profile', profileRoutes);
app.use('/api/centre-management', centreManagementRoutes);

// Support tickets
const ticketRoutes = require('./routes/ticketRoutes');
app.use('/api/tickets', ticketRoutes);

// Swagger setup
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Internal server error" });
});

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await sql.connect(config);
    console.log("Database connected successfully");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
    });
  } catch (err) {
    console.error("Database connection failed:", err);
  }
}

startServer();
