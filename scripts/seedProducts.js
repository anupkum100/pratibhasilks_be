require("dotenv").config();

const connectDB = require("../db");

const Product = require("../models/Product");

const products = require("../data/products");

async function seedProducts() {
    try {
        await connectDB();

        await Product.deleteMany();

        await Product.insertMany(products);

        console.log("Products seeded successfully");

        process.exit();
    } catch (error) {
        console.error(error);

        process.exit(1);
    }
}

seedProducts();