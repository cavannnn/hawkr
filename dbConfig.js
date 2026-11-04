const path = require("path");
const dotenv = require("dotenv");

const envFiles = [path.join(__dirname, ".env"), path.join(__dirname, "loginCredentials.env")];
for (const envFile of envFiles) {
  dotenv.config({ path: envFile });
}

const serverHost = process.env.DB_SERVER || process.env.DB_HOST || "localhost";
const port = Number(process.env.DB_PORT || 1433);

module.exports = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: serverHost,
  database: process.env.DB_DATABASE || "HawkerDatabase",
  options: {
    trustServerCertificate: true,
    encrypt: false,
    port,
    connectionTimeout: 60000
  }
};
