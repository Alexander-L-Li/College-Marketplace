const express = require("express");
const pool = require("./db/db");
const bcrypt = require("bcrypt");
const cors = require("cors");
const sendEmail = require("./utils/sendEmail");
const { canRequestReset } = require("./utils/rateLimiter");
const { v4: uuidv4 } = require("uuid");

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
      return res.status(401).send("Invalid password. Try again.");
    }
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).send("Server error.");
  }
});

// Fetch listings with search and sort
app.get("/listings", async (req, res) => {
  const { search, sort } = req.query;

  const sortOptions = {
    name_asc: "l.name ASC",
    name_desc: "l.name DESC",
    price_asc: "l.price ASC",
    price_desc: "l.price DESC",
    latest: "l.posted_at DESC",
    oldest: "l.posted_at ASC",
  };

  if (sort && !sortOptions.hasOwnProperty(sort)) {
    return res.status(400).send("Invalid sort option.");
  }

  const orderBy = sortOptions[sort] || "l.posted_at DESC"; // default fallback

  try {
    let values = [];
    let whereClause = "";

    if (search) {
      values.push(`%${search}%`);
      whereClause = `WHERE l.name ILIKE $1 OR l.description ILIKE $1 OR c.name ILIKE $1`;
    }

    const listingsQuery = `
    SELECT l.id, l.name, l.price, l.description, l.college, l.posted_at, 
    (
    SELECT image_url 
    FROM listing_images 
    WHERE listing_id = l.id AND is_cover = true 
    LIMIT 1
    ) AS cover_image_url,
    ARRAY_AGG(DISTINCT c.name) AS categories,
    ARRAY_AGG(DISTINCT i.image_url) AS images
    FROM listings l
    LEFT JOIN listing_categories lc ON l.id = lc.listing_id
    LEFT JOIN categories c ON lc.category_id = c.id
    LEFT JOIN listing_images i ON l.id = i.listing_id
    ${whereClause}
    GROUP BY l.id
    ORDER BY ${orderBy};`;

    const result = await pool.query(listingsQuery, values);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error.");
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

      let category_id;

      if (categoryQuery.rows.length === 0) {
        const categoryIdQuery = await pool.query(
          `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
          [category_name]
        );
        category_id = categoryIdQuery.rows[0].id;
      } else {
        category_id = categoryQuery.rows[0].id;
      }

      // always insert into the join table
      await pool.query(
        `INSERT INTO listing_categories (listing_id, category_id) VALUES ($1, $2)`,
        [newListingId, category_id]
      );
    }

    for (let image of image_urls) {
      await pool.query(
        `INSERT INTO listing_images (listing_id, image_url, is_cover)
         VALUES ($1, $2, $3)`,
        [newListingId, image.url, image.is_cover]
      );
    }

    res.status(201).send("Listing created successfully.");
  } catch (err) {
    console.error(err);
    res.status(500).send("Network error.");
  }
});

// Reset password
app.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    const result = await pool.query(`SELECT id FROM users WHERE email = $1`, [
      email,
    ]);

    if (!canRequestReset(email)) {
      return res
        .status(429)
        .send("You can request a password reset only once every 5 minutes.");
    }

    if (result.rows.length === 0) {
      return res.status(404).send("User not found.");
    } else {
      const user_id = result.rows[0].id;
      const token = uuidv4();
      const expiration_time = new Date(Date.now() + 3600000);
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at)
         VALUES ($1, $2, $3)`,
        [user_id, token, expiration_time]
      );

      const resetLink = `${process.env.FRONTEND_BASE_URL}/reset-password?token=${token}`;

      await sendEmail(
        email,
        "Password Reset for DormSpace",
        `Link to reset your DormSpace account password: ${resetLink}`
      );

      return res.status(200).send("Password reset email sent.");
    }
  } catch (err) {
    console.error(err);
    res.status(500).send("Failed to reset password.");
  }
});

// Verify email
app.post("/verify", async (req, res) => {
  const { user_id, code } = req.body;

  const result = await pool.query(
    `SELECT * FROM email_verification_codes WHERE user_id = $1 AND code = $2 AND expires_at > NOW()`,
    [user_id, code]
  );

  if (result.rows.length === 0) {
    return res.status(400).send("Invalid code.");
  } else {
    await pool.query(`UPDATE users SET is_verified = true WHERE user_id = $1`, [
      user_id,
    ]);
  }
});
