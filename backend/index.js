const express = require("express");
const pool = require("./db/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const sendEmail = require("./utils/sendEmail");
const { canRequestReset } = require("./utils/rateLimiter");
const { v4: uuidv4 } = require("uuid");

require("dotenv").config();

function generateSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const CODE_EXPIRY_MS = 30 * 1000;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// JWT verification middleware
function jwtMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).send("401 Unauthorized. No token provided.");
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).send("401 Unauthorized. Invalid or expired token.");
  }
}

// Register the user
app.post("/register", async (req, res) => {
  const { first_name, last_name, email, password } = req.body;

  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
  const now = new Date();

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

    const userId = newUser.rows[0].id;

    await pool.query(
      `INSERT INTO email_verification_codes (user_id, code, expires_at, last_sent)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id)
       DO UPDATE SET code = EXCLUDED.code, expires_at = EXCLUDED.expires_at, last_sent = EXCLUDED.last_sent`,
      [userId, code, expiresAt, now]
    );

    await sendEmail(
      email,
      "Verify your Dorm Space email",
      `Enter this 6-digit code to verify your account: ${code}`
    );

    res.status(200).json({ user_id: userId });
  } catch (err) {
    console.error(err);
    if (err.code == "23505") {
      res.status(409).json({ error: "Account already exists, please log in!" });
    } else {
      res.status(500).send("Network error.");
    }
  }
});

// Login the user
app.post("/login", async (req, res) => {
  const { email_entry, password_entry } = req.body;

  try {
    const result = await pool.query(`SELECT * FROM users WHERE email = $1`, [
      email_entry,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).send("User not found.");
    }

    const verificationQuery = await pool.query(
      `SELECT password, is_verified FROM users WHERE email = $1`,
      [email_entry]
    );

    if (!verificationQuery.rows[0].is_verified) {
      return res
        .status(403)
        .send("Please verify your email before logging in.");
    }

    const match = await bcrypt.compare(password_entry, result.rows[0].password);

    if (match) {
      const token = jwt.sign(
        { id: result.rows[0].id, email: result.rows[0].email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      return res.status(200).json({ token: token, email: email_entry });
    } else {
      return res.status(401).send("Invalid password. Try again.");
    }
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).send("Server error.");
  }
});

// Fetch listings with search and sort
app.get("/listings", jwtMiddleware, async (req, res) => {
  const { search, sort } = req.query;

  const sortOptions = {
    name_asc: "l.title ASC",
    name_desc: "l.title DESC",
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
      whereClause = `WHERE l.title ILIKE $1 OR l.description ILIKE $1 OR c.name ILIKE $1`;
    }

    const listingsQuery = `
    SELECT l.id, l.title, l.price, l.description, l.college, l.posted_at, 
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
app.post("/listings", jwtMiddleware, async (req, res) => {
  const { title, categories, price, description, college, image_urls } =
    req.body;

  if (!image_urls || !Array.isArray(image_urls)) {
    return res.status(400).send("Please upload at least one photo.");
  } else if (image_urls.length > 6) {
    return res.status(400).send("Cannot upload more than 6 images.");
  }

  try {
    const newListingQuery = await pool.query(
      `INSERT INTO listings (title, price, description, college)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [title, price, description, college]
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

  const isverifiedQuery = await pool.query(
    `SELECT is_verified FROM users WHERE id = $1`,
    [user_id]
  );

  if (isverifiedQuery.rowCount === 0) {
    return res.status(404).send("User not found.");
  }

  if (isverifiedQuery.rows[0].is_verified === true) {
    return res.status(400).send("This user has already been verified.");
  }

  const result = await pool.query(
    `SELECT code, expires_at FROM email_verification_codes WHERE user_id = $1`,
    [user_id]
  );

  if (result.rowCount === 0) {
    return res.status(404).send("No code found");
  }

  const { code: storedCode, expires_at } = result.rows[0];

  if (storedCode !== code || new Date() > expires_at) {
    console.warn(`Invalid or expired code attempt for user_id ${user_id}`);
    return res.status(400).send("Invalid or expired code");
  }

  await pool.query(`UPDATE users SET is_verified = true WHERE id = $1`, [
    user_id,
  ]);
  await pool.query(`DELETE FROM email_verification_codes WHERE user_id = $1`, [
    user_id,
  ]);

  return res.sendStatus(200);
});

// Resend verification email
app.post("/resend-verification", async (req, res) => {
  const { user_id } = req.body;

  const isverifiedQuery = await pool.query(
    `SELECT is_verified FROM users WHERE id = $1`,
    [user_id]
  );

  if (isverifiedQuery.rows[0].is_verified === true) {
    return res.status(400).send("This user has already been verified.");
  }

  const result = await pool.query(
    `SELECT last_sent FROM email_verification_codes WHERE user_id = $1`,
    [user_id]
  );

  if (result.rowCount === 0 || isverifiedQuery.rowCount === 0) {
    return res.status(404).send("User not found");
  }

  const { last_sent } = result.rows[0];
  const now = new Date();
  const secondsSinceLastSend = (now - last_sent) / 1000;

  if (secondsSinceLastSend < 30)
    return res.status(429).send("Wait before resending");

  const newCode = generateSixDigitCode();
  const newExpires = new Date(Date.now() + CODE_EXPIRY_MS);

  await pool.query(
    `UPDATE email_verification_codes SET code = $1, expires_at = $2, last_sent = $3 WHERE user_id = $4`,
    [newCode, newExpires, now, user_id]
  );

  const emailQuery = await pool.query(`SELECT email FROM users WHERE id = $1`, [
    user_id,
  ]);
  const email = emailQuery.rows[0]?.email;

  if (!email) {
    return res.status(404).send("Email not found for user.");
  }

  await sendEmail(
    email,
    "Your new Dorm Space verification code",
    `Enter this 6-digit code to verify your account: ${newCode}`
  );

  return res.sendStatus(200);
});

// Get current user's profile data
app.get("/profile", jwtMiddleware, async (req, res) => {
  // Your implementation here
});
