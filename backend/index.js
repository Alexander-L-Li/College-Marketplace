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
  const { first_name, last_name, email, password, username } = req.body;

  const code = generateSixDigitCode();
  const expiresAt = new Date(Date.now() + CODE_EXPIRY_MS);
  const now = new Date();

  if (!email.endsWith(".edu")) {
    return res.status(400).send("Email must be .edu");
  }

  // Username validation
  if (!username || username.trim().length < 3 || username.trim().length > 30) {
    return res
      .status(400)
      .send("Username must be between 3 and 30 characters.");
  }

  // Username format validation (alphanumeric + underscores only)
  const usernameRegex = /^[a-zA-Z0-9_]+$/;
  if (!usernameRegex.test(username)) {
    return res
      .status(400)
      .send("Username can only contain letters, numbers, and underscores.");
  }

  // Check for reserved usernames
  const reservedUsernames = [
    "admin",
    "moderator",
    "support",
    "help",
    "info",
    "system",
  ];
  if (reservedUsernames.includes(username.toLowerCase())) {
    return res.status(400).send("Username is reserved and cannot be used.");
  }

  const collegeDomain = email.split("@")[1].split(".")[0];

  // Map college domains to proper display names
  const collegeMap = {
    mit: "MIT",
    harvard: "Harvard",
  };

  const college = collegeMap[collegeDomain] || collegeDomain;

  try {
    const hashed_password = await bcrypt.hash(password, 10);
    const newUser = await pool.query(
      `INSERT INTO users (first_name, last_name, email, college, password, username)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [first_name, last_name, email, college, hashed_password, username.trim()]
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
      // Check if it's a username or email conflict
      if (err.constraint === "users_username_key") {
        res
          .status(409)
          .json({ error: "Username already taken, please choose another." });
      } else if (err.constraint === "users_email_unique") {
        res
          .status(409)
          .json({ error: "Account already exists, please log in!" });
      } else {
        res
          .status(409)
          .json({ error: "Account already exists, please log in!" });
      }
    } else {
      res.status(500).send("Network error.");
    }
  }
});

// Login the user
app.post("/login", async (req, res) => {
  const { email_entry, password_entry } = req.body;

  try {
    // Check if input is email or username
    const isEmail = email_entry.includes("@");

    let result;
    if (isEmail) {
      result = await pool.query(`SELECT * FROM users WHERE email = $1`, [
        email_entry,
      ]);
    } else {
      result = await pool.query(`SELECT * FROM users WHERE username = $1`, [
        email_entry,
      ]);
    }

    if (result.rows.length === 0) {
      return res.status(404).send("User not found.");
    }

    const user = result.rows[0];

    if (!user.is_verified) {
      return res
        .status(403)
        .send("Please verify your email before logging in.");
    }

    const match = await bcrypt.compare(password_entry, user.password);

    if (match) {
      const token = jwt.sign(
        { id: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      return res.status(200).json({ token: token, email: user.email });
    } else {
      return res.status(401).send("Invalid password. Try again.");
    }
  } catch (err) {
    console.error("Login route error:", err);
    res.status(500).send("Server error.");
  }
});

// Get dorms for a specific college
app.get("/dorms/:college", async (req, res) => {
  const { college } = req.params;

  try {
    const result = await pool.query(
      `
      SELECT d.id, d.name 
      FROM dorms d 
      JOIN colleges c ON d.college_id = c.id 
      WHERE c.name = $1 
      ORDER BY d.name
    `,
      [college]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error.");
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
    u.first_name, u.last_name, u.username, d.name as dorm_name,
    (
    SELECT image_url 
    FROM listing_images 
    WHERE listing_id = l.id AND is_cover = true 
    LIMIT 1
    ) AS cover_image_url,
    ARRAY_AGG(DISTINCT c.name) AS categories,
    ARRAY_AGG(DISTINCT i.image_url) AS images
    FROM listings l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN dorms d ON u.dorm_id = d.id
    LEFT JOIN listing_categories lc ON l.id = lc.listing_id
    LEFT JOIN categories c ON lc.category_id = c.id
    LEFT JOIN listing_images i ON l.id = i.listing_id
    ${whereClause}
    GROUP BY l.id, u.first_name, u.last_name, u.username, d.name
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
      `INSERT INTO listings (title, price, description, college, user_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
      [title, price, description, college, req.user.id]
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
  const user_id = req.user.id;
  try {
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.college, u.created_at, u.is_verified, u.username, d.name as dorm_name
       FROM users u 
       LEFT JOIN dorms d ON u.dorm_id = d.id 
       WHERE u.id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("User not found.");
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error.");
  }
});

// Update current user's profile info
app.patch("/profile", jwtMiddleware, async (req, res) => {
  const { first_name, last_name, username, dorm_id } = req.body;
  const user_id = req.user.id;

  if (!first_name && !last_name && !username && !dorm_id) {
    return res.status(400).send("At least one field must be provided.");
  }

  try {
    let query = "UPDATE users SET ";
    let values = [];
    let paramCount = 1;

    if (first_name) {
      if (first_name.trim().length === 0) {
        return res.status(400).send("First name cannot be empty.");
      }
      query += `first_name = $${paramCount}`;
      values.push(first_name.trim());
      paramCount++;
    }

    if (last_name) {
      if (last_name.trim().length === 0) {
        return res.status(400).send("Last name cannot be empty.");
      }
      if (first_name) query += ", ";
      query += `last_name = $${paramCount}`;
      values.push(last_name.trim());
      paramCount++;
    }

    if (username) {
      if (username.trim().length < 3 || username.trim().length > 30) {
        return res
          .status(400)
          .send("Username must be between 3 and 30 characters.");
      }

      // Username format validation (alphanumeric + underscores only)
      const usernameRegex = /^[a-zA-Z0-9_]+$/;
      if (!usernameRegex.test(username)) {
        return res
          .status(400)
          .send("Username can only contain letters, numbers, and underscores.");
      }

      // Check for reserved usernames
      const reservedUsernames = [
        "admin",
        "moderator",
        "support",
        "help",
        "info",
        "system",
      ];
      if (reservedUsernames.includes(username.toLowerCase())) {
        return res.status(400).send("Username is reserved and cannot be used.");
      }

      // Check username uniqueness (excluding current user)
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE username = $1 AND id != $2`,
        [username.trim(), user_id]
      );
      if (existingUser.rows.length > 0) {
        return res
          .status(409)
          .send("Username already taken, please choose another.");
      }

      if (first_name || last_name) query += ", ";
      query += `username = $${paramCount}`;
      values.push(username.trim());
      paramCount++;
    }

    if (dorm_id) {
      // Validate that dorm_id exists and belongs to user's college
      const dormCheck = await pool.query(
        `
        SELECT d.id FROM dorms d 
        JOIN colleges c ON d.college_id = c.id 
        JOIN users u ON u.college = c.name 
        WHERE d.id = $1 AND u.id = $2
      `,
        [dorm_id, user_id]
      );

      if (dormCheck.rows.length === 0) {
        return res.status(400).send("Invalid dorm selection.");
      }

      if (first_name || last_name || username) query += ", ";
      query += `dorm_id = $${paramCount}`;
      values.push(dorm_id);
      paramCount++;
    }

    query += ` WHERE id = $${paramCount}`;
    values.push(user_id);

    await pool.query(query, values);

    // Return updated profile
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.college, u.created_at, u.is_verified, u.username, d.name as dorm_name
       FROM users u 
       LEFT JOIN dorms d ON u.dorm_id = d.id 
       WHERE u.id = $1`,
      [user_id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error.");
  }
});
