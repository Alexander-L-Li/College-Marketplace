const express = require("express");
const pool = require("./db");
const bcrypt = require("bcrypt");
const cors = require("cors");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Register the user
app.post("/register", async (req, res) => {
  const { first_name, last_name, email, password } = req.body;

  if (!email.endsWith(".edu")) {
    return res.status(400).send("Email must be .edu");
  }

  const college = email.split("@")[1].split(".")[0];

  try {
    const hashed_password = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      `INSERT INTO users (first_name, last_name, email, college, password)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [first_name, last_name, email, college, hashed_password]
    );
    res.json(newUser.rows[0]);
  } catch (err) {
    console.error(err);
    if (err.code == "23505") {
      res.status(500).send("Account already exists, please log in!");
    } else {
      res.status(500).send("Network error.");
    }
  }
});

// Login the user
app.post("/login", async (req, res) => {
  const { email_entry, password_entry } = req.body;

  try {
    const result = await pool.query(
      `SELECT password FROM users WHERE email = $1`,
      [email_entry]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("User not found.");
    }

    const match = await bcrypt.compare(password_entry, result.rows[0].password);
    if (match) {
      return res
        .status(200)
        .json({ token: "fake-session-token", email: email_entry });
    } else {
      return res.status(401).json({ message: "Invalid password." });
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error.");
  }
});

// Fetch listings with search and sort
app.get("/listings", async (req, res) => {
  const { search, sort } = req.query;

  try {
    let baseQuery = "SELECT * FROM listings";
    let values = [];
    let conditions = [];
    let sortQuery = "ORDER BY posted_at DESC";

    if (search) {
      conditions.push("(name ILIKE $1 OR description ILIKE $1)");
      values.push(`%${search}%`);
    }

    const allowedSortFields = ["price", "name", "posted_at"];

    if (sort && allowedSortFields.includes(sort)) {
      sortQuery = `ORDER BY ${sort} ASC`;
    }

    if (conditions.length) {
      baseQuery += " WHERE " + conditions.join(" AND ");
    }

    const finalQuery = baseQuery + " " + sortQuery;

    const result = await pool.query(finalQuery, values);
    for (let listing of result.rows) {
      const categoryQuery = await pool.query(
        `SELECT c.name
         FROM categories c
         JOIN listing_categories lc ON c.id = lc.category_id
         WHERE lc.listing_id = $1`,
        [listing.id]
      );

      listing.categories = categoryQuery.rows.map((row) => row.name);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

// Post new listings
app.post("/listings", async (req, res) => {
  const { name, categories, price, description, college, image_urls } =
    req.body;

  if (!image_urls || !Array.isArray(image_urls)) {
    return res.status(400).send("Please upload at least one photo.");
  } else if (image_urls.length > 6) {
    return res.status(400).send("Cannot upload more than 6 images.");
  }

  try {
    const newListingQuery = await pool.query(
      `INSERT INTO listings (name, price, description, college)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [name, price, description, college]
    );
    const newListingId = newListingQuery.rows[0].id;

    for (let category_name of categories) {
      const categoryQuery = await pool.query(
        `SELECT id FROM categories WHERE name = $1`,
        [category_name]
      );

      let category_id = categoryQuery.rows[0].id; // default: existing id

      if (categoryQuery.rows.length === 0) {
        categoryIdQuery = await pool.query(
          `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
          [category_name]
        );
        category_id = categoryIdQuery.rows[0].id; // id of newly added category
      }

      // always insert into the join table
      await pool.query(
        `INSERT INTO listing_categories (listing_id, category_id) VALUES ($1, $2)`,
        [newListingId, category_id]
      );
    }
    for (let url of image_urls) {
      await pool.query(
        `INSERT INTO listing_images (listing_id, image_url)
           VALUES ($1, $2)`,
        [newListingId, url]
      );
    }

    res.status(201).send("Listing created successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Network error.");
  }
});
