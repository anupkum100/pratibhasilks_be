require("dotenv").config();

const bcrypt = require("bcryptjs");
const connectDB = require("../db");
const Admin = require("../models/Admin");

async function createAdmin() {
  try {
    await connectDB();

    const email = process.env.ADMIN_EMAIL || "admin@example.com";
    const plainPassword = process.env.ADMIN_PASSWORD || "password123";

    const existingAdmin = await Admin.findOne({ email });

    if (existingAdmin) {
      console.log("Admin already exists:", email);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    await Admin.create({
      email,
      password: hashedPassword
    });

    console.log("Admin created successfully");
    console.log("Email:", email);
    console.log("Password:", plainPassword);

    process.exit(0);
  } catch (error) {
    console.error("Create admin error:", error);
    process.exit(1);
  }
}

createAdmin();
