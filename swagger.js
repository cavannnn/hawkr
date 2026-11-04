const swaggerAutogen = require("swagger-autogen")({ openapi: "3.0.0" });

const outputFile = "./swagger-output.json";
const routes = ["./app.js"];

const doc = {
  info: {
    title: "Hawker API",
    version: "1.0.0",
    description:
      "Hawker centre management API covering customers, vendors, operators and NEA officers."
  },
  servers: [{ url: "http://localhost:3000" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    }
  },
  tags: [
    { name: "User", description: "Registration and login" },
    { name: "Hawkers", description: "Hawker centres and centre feedback" },
    { name: "Stalls", description: "Stalls and their live promotions" },
    { name: "Menu", description: "Stall menus" },
    { name: "Orders", description: "Customer orders" },
    { name: "Favorites", description: "Saved centres, stalls and dishes" },
    { name: "Vouchers", description: "Voucher validation" },
    { name: "Reviews", description: "Customer reviews of a stall" },
    { name: "Customers", description: "Customer profile, allergens and cuisines" },
    { name: "Vendor", description: "Vendor dashboard, stores, orders and notifications" },
    { name: "Operator", description: "Stall requests, rental renewals and centre management" },
    { name: "Tickets", description: "Support tickets" },
    { name: "Inspections", description: "NEA inspections and stall grading" },
    { name: "Public", description: "Unauthenticated read-only endpoints" }
  ]
};

swaggerAutogen(outputFile, routes, doc);
