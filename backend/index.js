const express = require("express");
const pool = require("./db/db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const sendEmail = require("./utils/sendEmail");
const { canRequestReset, canRequestAI } = require("./utils/rateLimiter");
const { v4: uuidv4 } = require("uuid");
const {
  generateUploadURL,
  generateProfileUploadURL,
  generateViewURL,
  deleteImage,
} = require("./config/s3");

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

// -----------------------------
// Realtime (SSE)
// -----------------------------

const sseClientsByUserId = new Map(); // userId -> Set(res)

function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function addSseClient(userId, res) {
  if (!sseClientsByUserId.has(userId)) {
    sseClientsByUserId.set(userId, new Set());
  }
  sseClientsByUserId.get(userId).add(res);
}

function removeSseClient(userId, res) {
  const set = sseClientsByUserId.get(userId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) sseClientsByUserId.delete(userId);
}

function emitToUser(userId, event, data) {
  const set = sseClientsByUserId.get(userId);
  if (!set) return;
  for (const res of set) {
    try {
      sseWrite(res, event, data);
    } catch {
      // ignore
    }
  }
}

async function computeUnreadTotal(userId) {
  const hasReads = await conversationsHasReadColumns();
  if (!hasReads) return 0;

  const q = `
    SELECT COALESCE(SUM(
      (
        SELECT COUNT(*)
        FROM messages m
        WHERE m.conversation_id = c.id
          AND m.sender_id <> $1
          AND m.created_at > COALESCE(
            CASE WHEN c.buyer_id = $1 THEN c.last_read_at_buyer ELSE c.last_read_at_seller END,
            TIMESTAMP '1970-01-01'
          )
      )
    ), 0)::int AS total_unread
    FROM conversations c
    WHERE c.buyer_id = $1 OR c.seller_id = $1;
  `;
  const result = await pool.query(q, [userId]);
  return result.rows[0]?.total_unread ?? 0;
}

async function emitUnreadTotal(userId) {
  try {
    const total_unread = await computeUnreadTotal(userId);
    emitToUser(userId, "unread", { total_unread });
  } catch (err) {
    console.error("emitUnreadTotal error:", err);
  }
}

function getJwtFromRequest(req) {
  // EventSource cannot set Authorization headers, so we accept token via query param.
  // NOTE: For production, prefer HttpOnly cookies.
  const tokenFromQuery = req.query?.token;
  if (tokenFromQuery && typeof tokenFromQuery === "string")
    return tokenFromQuery;
  const tokenFromHeader = req.headers.authorization?.split(" ")[1];
  if (tokenFromHeader) return tokenFromHeader;
  return null;
}

// SSE stream for current user (message/read/unread events)
app.get("/events", async (req, res) => {
  try {
    const token = getJwtFromRequest(req);
    if (!token) {
      return res.status(401).send("Missing token");
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const userId = payload.id;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    addSseClient(userId, res);

    sseWrite(res, "connected", { ok: true });
    await emitUnreadTotal(userId);

    const keepAlive = setInterval(() => {
      try {
        res.write(": ping\n\n");
      } catch {
        // ignore
      }
    }, 25000);

    req.on("close", () => {
      clearInterval(keepAlive);
      removeSseClient(userId, res);
    });
  } catch (err) {
    console.error("GET /events error:", err);
    return res.status(401).send("Invalid token");
  }
});

let _usersHasProfileImageKeyColumn = null;
async function usersHasProfileImageKeyColumn() {
  if (_usersHasProfileImageKeyColumn !== null) {
    return _usersHasProfileImageKeyColumn;
  }
  try {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'profile_image_key'
       LIMIT 1`
    );
    _usersHasProfileImageKeyColumn = result.rowCount > 0;
    return _usersHasProfileImageKeyColumn;
  } catch (err) {
    console.error("Error checking users.profile_image_key column:", err);
    _usersHasProfileImageKeyColumn = false;
    return false;
  }
}

let _listingsHasIsSoldColumn = null;
async function listingsHasIsSoldColumn() {
  // If the column exists, cache that truthy result.
  // If it doesn't exist yet, DON'T cache false forever (migrations can add it while server is running).
  if (_listingsHasIsSoldColumn === true) return true;
  try {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'listings' AND column_name = 'is_sold'
       LIMIT 1`
    );
    const exists = result.rowCount > 0;
    if (exists) _listingsHasIsSoldColumn = true;
    return exists;
  } catch (err) {
    console.error("Error checking listings.is_sold column:", err);
    _listingsHasIsSoldColumn = false;
    return false;
  }
}

let _conversationsHasReadColumns = null;
async function conversationsHasReadColumns() {
  if (_conversationsHasReadColumns !== null)
    return _conversationsHasReadColumns;
  try {
    const result = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_name = 'conversations'
         AND column_name IN ('last_read_at_buyer', 'last_read_at_seller')
       GROUP BY table_name
       HAVING COUNT(*) = 2`
    );
    _conversationsHasReadColumns = result.rowCount > 0;
    return _conversationsHasReadColumns;
  } catch (err) {
    console.error("Error checking conversations last_read_at columns:", err);
    _conversationsHasReadColumns = false;
    return false;
  }
}

let _hasSavedListingsTable = null;
async function hasSavedListingsTable() {
  if (_hasSavedListingsTable !== null) return _hasSavedListingsTable;
  try {
    const result = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_listings' LIMIT 1`
    );
    _hasSavedListingsTable = result.rowCount > 0;
    return _hasSavedListingsTable;
  } catch (err) {
    console.error("Error checking saved_listings table:", err);
    _hasSavedListingsTable = false;
    return false;
  }
}

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
      ORDER BY d.display_order, d.name
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
  const { search, sort, exclude_own, include_sold, category_ids } = req.query;

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
    const hasIsSold = await listingsHasIsSoldColumn();
    const selectIsSold = hasIsSold ? ", l.is_sold" : ", false as is_sold";
    const hasSaved = await hasSavedListingsTable();
    const selectIsSaved = hasSaved
      ? `,
        COALESCE(BOOL_OR(sl.user_id IS NOT NULL), false) AS is_saved`
      : ", false AS is_saved";

    const values = [];
    const conditions = [];

    // If favorites table exists, we join it for this user and also return is_saved.
    // This consumes $1, so subsequent filters naturally start at $2.
    const savedJoin = hasSaved
      ? "LEFT JOIN saved_listings sl ON sl.listing_id = l.id AND sl.user_id = $1"
      : "";
    if (hasSaved) {
      values.push(req.user.id); // $1 reserved for sl.user_id
    }

    if (search) {
      values.push(`%${search}%`);
      const p = values.length;
      conditions.push(
        `(l.title ILIKE $${p} OR l.description ILIKE $${p} OR c.name ILIKE $${p})`
      );
    }

    // Category filter (multi-select). Expects comma-separated UUIDs:
    // /listings?category_ids=<uuid>,<uuid>
    if (category_ids) {
      const raw = Array.isArray(category_ids)
        ? category_ids.join(",")
        : String(category_ids);
      const ids = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const uuidRe =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      const invalid = ids.find((id) => !uuidRe.test(id));
      if (invalid) {
        return res.status(400).send("Invalid category_ids.");
      }

      if (ids.length > 0) {
        values.push(ids);
        const p = values.length;
        // Use EXISTS so the categories aggregation still returns all categories for the listing
        conditions.push(
          `EXISTS (
            SELECT 1
            FROM listing_categories lc2
            WHERE lc2.listing_id = l.id
              AND lc2.category_id = ANY($${p}::uuid[])
          )`
        );
      }
    }

    const shouldExcludeOwn =
      exclude_own === "1" || exclude_own === "true" || exclude_own === "yes";
    if (shouldExcludeOwn) {
      values.push(req.user.id);
      const p = values.length;
      conditions.push(`l.user_id <> $${p}`);
    }

    // Exclude sold listings from the marketplace feed/search by default
    // (unless include_sold is explicitly requested)
    const shouldIncludeSold =
      include_sold === "1" || include_sold === "true" || include_sold === "yes";
    if (hasIsSold && !shouldIncludeSold) {
      conditions.push(`l.is_sold = false`);
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const listingsQuery = `
    SELECT l.id, l.title, l.price, l.description, l.college, l.posted_at${selectIsSold}${selectIsSaved}, 
    u.first_name, u.last_name, u.username, d.name as dorm_name,
    COALESCE(
      (
        SELECT image_url 
        FROM listing_images 
        WHERE listing_id = l.id AND is_cover = true 
        LIMIT 1
      ),
      (
        SELECT image_url
        FROM listing_images
        WHERE listing_id = l.id
        ORDER BY uploaded_at ASC
        LIMIT 1
      )
    ) AS cover_image_url,
    COALESCE(array_remove(array_agg(DISTINCT c.name), NULL), ARRAY[]::text[]) AS categories,
    COALESCE(array_remove(array_agg(DISTINCT i.image_url), NULL), ARRAY[]::text[]) AS images
    FROM listings l
    LEFT JOIN users u ON l.user_id = u.id
    LEFT JOIN dorms d ON u.dorm_id = d.id
    LEFT JOIN listing_categories lc ON l.id = lc.listing_id
    LEFT JOIN categories c ON lc.category_id = c.id
    LEFT JOIN listing_images i ON l.id = i.listing_id
    ${savedJoin}
    ${whereClause}
    GROUP BY l.id, u.first_name, u.last_name, u.username, d.name
    ORDER BY ${orderBy};`;

    const result = await pool.query(listingsQuery, values);

    // Convert S3 keys to viewable URLs
    const listingsWithUrls = await Promise.all(
      result.rows.map(async (listing) => {
        const listingCopy = { ...listing };

        // Generate view URL for cover image if it exists and is an S3 key
        if (
          listing.cover_image_url &&
          !listing.cover_image_url.startsWith("http")
        ) {
          try {
            listingCopy.cover_image_url = await generateViewURL(
              listing.cover_image_url
            );
          } catch (err) {
            console.error("Error generating cover image URL:", err);
            listingCopy.cover_image_url = null;
          }
        }

        // Generate view URLs for all images if they exist
        if (listing.images && Array.isArray(listing.images)) {
          listingCopy.images = await Promise.all(
            listing.images.map(async (imageUrl) => {
              // If it's already a full URL (legacy), return as-is
              if (imageUrl && imageUrl.startsWith("http")) {
                return imageUrl;
              }
              // If it's an S3 key, generate presigned URL
              if (imageUrl && !imageUrl.startsWith("blob:")) {
                try {
                  return await generateViewURL(imageUrl);
                } catch (err) {
                  console.error("Error generating image URL:", err);
                  return null;
                }
              }
              return imageUrl;
            })
          );
        }

        return listingCopy;
      })
    );

    res.json(listingsWithUrls);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error.");
  }
});

// Get current user's listings (for My Listings management)
app.get("/my-listings", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;
  try {
    const hasIsSold = await listingsHasIsSoldColumn();
    const selectIsSold = hasIsSold ? "l.is_sold" : "false as is_sold";

    const q = `
      SELECT
        l.id, l.title, l.price, l.description, l.college, l.posted_at,
        ${selectIsSold},
        (
          SELECT image_url
          FROM listing_images
          WHERE listing_id = l.id AND is_cover = true
          LIMIT 1
        ) AS cover_image_url,
        COALESCE(array_remove(array_agg(DISTINCT c.name), NULL), ARRAY[]::text[]) as categories
      FROM listings l
      LEFT JOIN listing_categories lc ON l.id = lc.listing_id
      LEFT JOIN categories c ON lc.category_id = c.id
      WHERE l.user_id = $1
      GROUP BY l.id
      ORDER BY l.posted_at DESC;
    `;

    const result = await pool.query(q, [user_id]);

    const withUrls = await Promise.all(
      result.rows.map(async (row) => {
        const out = { ...row };
        if (out.cover_image_url && !out.cover_image_url.startsWith("http")) {
          try {
            out.cover_image_url = await generateViewURL(out.cover_image_url);
          } catch (err) {
            console.error("Error generating my listing cover url:", err);
            out.cover_image_url = null;
          }
        }
        return out;
      })
    );

    return res.json({ listings: withUrls });
  } catch (err) {
    console.error("GET /my-listings error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

// Favorites / Saved listings
app.get("/saved-listings", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;
  try {
    const hasSaved = await hasSavedListingsTable();
    if (!hasSaved) {
      return res.status(500).json({
        error:
          "Database missing saved_listings table. Run the migration to add it.",
      });
    }

    const q = `
      SELECT
        l.id, l.title, l.price, l.description, l.college, l.posted_at,
        MAX(s.created_at) AS saved_at,
        (
          SELECT image_url
          FROM listing_images
          WHERE listing_id = l.id AND is_cover = true
          LIMIT 1
        ) AS cover_image_url,
        u.first_name, u.last_name, u.username,
        COALESCE(array_remove(array_agg(DISTINCT c.name), NULL), ARRAY[]::text[]) as categories
      FROM saved_listings s
      JOIN listings l ON l.id = s.listing_id
      LEFT JOIN users u ON u.id = l.user_id
      LEFT JOIN listing_categories lc ON l.id = lc.listing_id
      LEFT JOIN categories c ON lc.category_id = c.id
      WHERE s.user_id = $1
      GROUP BY l.id, u.first_name, u.last_name, u.username
      ORDER BY saved_at DESC;
    `;

    const result = await pool.query(q, [user_id]);
    const withUrls = await Promise.all(
      result.rows.map(async (row) => {
        const out = { ...row, is_saved: true };
        if (out.cover_image_url && !out.cover_image_url.startsWith("http")) {
          try {
            out.cover_image_url = await generateViewURL(out.cover_image_url);
          } catch (err) {
            console.error("Error generating saved listing cover url:", err);
            out.cover_image_url = null;
          }
        }
        return out;
      })
    );

    return res.json({ listings: withUrls });
  } catch (err) {
    console.error("GET /saved-listings error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

app.post("/saved-listings", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { listing_id } = req.body || {};

  if (!listing_id) {
    return res.status(400).json({ error: "listing_id is required" });
  }

  try {
    const hasSaved = await hasSavedListingsTable();
    if (!hasSaved) {
      return res.status(500).json({
        error:
          "Database missing saved_listings table. Run the migration to add it.",
      });
    }

    const exists = await pool.query(`SELECT 1 FROM listings WHERE id = $1`, [
      listing_id,
    ]);
    if (exists.rowCount === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }

    await pool.query(
      `INSERT INTO saved_listings (user_id, listing_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, listing_id) DO NOTHING`,
      [user_id, listing_id]
    );

    return res.status(200).json({ ok: true, is_saved: true });
  } catch (err) {
    console.error("POST /saved-listings error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

app.delete("/saved-listings/:listing_id", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { listing_id } = req.params;

  try {
    const hasSaved = await hasSavedListingsTable();
    if (!hasSaved) {
      return res.status(500).json({
        error:
          "Database missing saved_listings table. Run the migration to add it.",
      });
    }

    await pool.query(
      `DELETE FROM saved_listings WHERE user_id = $1 AND listing_id = $2`,
      [user_id, listing_id]
    );
    return res.status(200).json({ ok: true, is_saved: false });
  } catch (err) {
    console.error("DELETE /saved-listings/:listing_id error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

// Update a listing (owner-only): title/price/description/categories and/or is_sold
app.patch("/listings/:id", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { id: listing_id } = req.params;
  const { title, price, description, categories, is_sold } = req.body || {};

  try {
    const ownerRes = await pool.query(
      `SELECT user_id FROM listings WHERE id = $1`,
      [listing_id]
    );
    if (ownerRes.rows.length === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (ownerRes.rows[0].user_id !== user_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const hasIsSold = await listingsHasIsSoldColumn();

    // Build update query
    const sets = [];
    const values = [];
    let p = 1;

    if (typeof title === "string") {
      sets.push(`title = $${p++}`);
      values.push(title.trim());
    }
    if (typeof description === "string") {
      sets.push(`description = $${p++}`);
      values.push(description.trim());
    }
    if (typeof price === "number") {
      sets.push(`price = $${p++}`);
      values.push(price);
    }
    if (typeof is_sold === "boolean") {
      if (!hasIsSold) {
        return res.status(500).json({
          error:
            "Database missing listings.is_sold column. Run the migration to add it.",
        });
      }
      sets.push(`is_sold = $${p++}`);
      values.push(is_sold);
    }

    if (sets.length > 0) {
      values.push(listing_id);
      await pool.query(
        `UPDATE listings SET ${sets.join(", ")} WHERE id = $${p}`,
        values
      );
    }

    // Replace categories if provided
    if (Array.isArray(categories)) {
      await pool.query(`DELETE FROM listing_categories WHERE listing_id = $1`, [
        listing_id,
      ]);
      for (const category_name of categories) {
        const cRes = await pool.query(
          `SELECT id FROM categories WHERE name = $1`,
          [category_name]
        );
        let category_id = cRes.rows[0]?.id;
        if (!category_id) {
          const ins = await pool.query(
            `INSERT INTO categories (name) VALUES ($1) RETURNING id`,
            [category_name]
          );
          category_id = ins.rows[0].id;
        }
        await pool.query(
          `INSERT INTO listing_categories (listing_id, category_id) VALUES ($1, $2)`,
          [listing_id, category_id]
        );
      }
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("PATCH /listings/:id error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

// Delete a listing (owner-only)
app.delete("/listings/:id", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { id: listing_id } = req.params;

  try {
    const ownerRes = await pool.query(
      `SELECT user_id FROM listings WHERE id = $1`,
      [listing_id]
    );
    if (ownerRes.rows.length === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (ownerRes.rows[0].user_id !== user_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Best-effort delete listing images in S3 (only if stored as keys)
    const imgs = await pool.query(
      `SELECT image_url FROM listing_images WHERE listing_id = $1`,
      [listing_id]
    );
    for (const r of imgs.rows) {
      const key = r.image_url;
      if (
        key &&
        typeof key === "string" &&
        !key.startsWith("http") &&
        !key.startsWith("blob:")
      ) {
        try {
          await deleteImage(key);
        } catch (err) {
          console.error("Failed to delete listing image from S3:", err);
        }
      }
    }

    await pool.query(`DELETE FROM listings WHERE id = $1`, [listing_id]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("DELETE /listings/:id error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

// -----------------------------
// Listing Images (owner-only management)
// -----------------------------

// Add images to an existing listing (expects S3 keys already uploaded via presigned URLs)
app.post("/listings/:id/images", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { id: listing_id } = req.params;
  const body = req.body || {};

  // Support either { image_urls: [{ url, is_cover }]} (matches create listing)
  // or { images: [{ key, is_cover }]}
  const incoming = Array.isArray(body.image_urls)
    ? body.image_urls
    : Array.isArray(body.images)
    ? body.images
    : null;

  if (!incoming || incoming.length === 0) {
    return res.status(400).json({ error: "No images provided." });
  }

  try {
    const ownerRes = await pool.query(
      `SELECT user_id FROM listings WHERE id = $1`,
      [listing_id]
    );
    if (ownerRes.rows.length === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (ownerRes.rows[0].user_id !== user_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const existingCountRes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM listing_images WHERE listing_id = $1`,
      [listing_id]
    );
    const existingCount = existingCountRes.rows[0]?.count ?? 0;
    if (existingCount + incoming.length > 6) {
      return res
        .status(400)
        .json({ error: "Cannot upload more than 6 images per listing." });
    }

    // Determine cover intent
    const normalized = incoming
      .map((img) => {
        const key = img?.key ?? img?.url;
        return {
          key,
          is_cover: !!img?.is_cover,
        };
      })
      .filter(
        (img) => typeof img.key === "string" && img.key.trim().length > 0
      );

    if (normalized.length === 0) {
      return res.status(400).json({ error: "No valid image keys provided." });
    }

    // If any incoming wants to be cover, only honor the first
    let coverIdx = normalized.findIndex((x) => x.is_cover);
    if (coverIdx !== -1) {
      normalized.forEach((x, i) => (x.is_cover = i === coverIdx));
    } else {
      // If there is no existing cover, make first incoming the cover
      const coverExistsRes = await pool.query(
        `SELECT 1 FROM listing_images WHERE listing_id = $1 AND is_cover = true LIMIT 1`,
        [listing_id]
      );
      if (coverExistsRes.rowCount === 0) {
        normalized[0].is_cover = true;
      }
    }

    await pool.query("BEGIN");

    // If setting a new cover in this batch, clear existing covers first
    if (normalized.some((x) => x.is_cover)) {
      await pool.query(
        `UPDATE listing_images SET is_cover = false WHERE listing_id = $1`,
        [listing_id]
      );
    }

    for (const img of normalized) {
      await pool.query(
        `INSERT INTO listing_images (listing_id, image_url, is_cover)
         VALUES ($1, $2, $3)`,
        [listing_id, img.key, img.is_cover]
      );
    }

    await pool.query("COMMIT");
    return res.status(201).json({ ok: true });
  } catch (err) {
    try {
      await pool.query("ROLLBACK");
    } catch {
      // ignore
    }
    console.error("POST /listings/:id/images error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

// Set cover image for a listing
app.patch(
  "/listings/:listingId/images/:imageId/cover",
  jwtMiddleware,
  async (req, res) => {
    const user_id = req.user.id;
    const { listingId, imageId } = req.params;

    try {
      const ownerRes = await pool.query(
        `SELECT user_id FROM listings WHERE id = $1`,
        [listingId]
      );
      if (ownerRes.rows.length === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (ownerRes.rows[0].user_id !== user_id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const imgRes = await pool.query(
        `SELECT id FROM listing_images WHERE id = $1 AND listing_id = $2`,
        [imageId, listingId]
      );
      if (imgRes.rowCount === 0) {
        return res.status(404).json({ error: "Image not found" });
      }

      await pool.query("BEGIN");
      await pool.query(
        `UPDATE listing_images SET is_cover = false WHERE listing_id = $1`,
        [listingId]
      );
      await pool.query(
        `UPDATE listing_images SET is_cover = true WHERE id = $1 AND listing_id = $2`,
        [imageId, listingId]
      );
      await pool.query("COMMIT");

      return res.json({ ok: true });
    } catch (err) {
      try {
        await pool.query("ROLLBACK");
      } catch {
        // ignore
      }
      console.error(
        "PATCH /listings/:listingId/images/:imageId/cover error:",
        err
      );
      return res.status(500).json({ error: "Database error." });
    }
  }
);

// Delete a listing image (and best-effort delete the S3 object if stored as a key)
app.delete(
  "/listings/:listingId/images/:imageId",
  jwtMiddleware,
  async (req, res) => {
    const user_id = req.user.id;
    const { listingId, imageId } = req.params;

    try {
      const ownerRes = await pool.query(
        `SELECT user_id FROM listings WHERE id = $1`,
        [listingId]
      );
      if (ownerRes.rows.length === 0) {
        return res.status(404).json({ error: "Listing not found" });
      }
      if (ownerRes.rows[0].user_id !== user_id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      await pool.query("BEGIN");

      const imgRes = await pool.query(
        `SELECT id, image_url, is_cover
         FROM listing_images
         WHERE id = $1 AND listing_id = $2`,
        [imageId, listingId]
      );
      if (imgRes.rowCount === 0) {
        await pool.query("ROLLBACK");
        return res.status(404).json({ error: "Image not found" });
      }

      const img = imgRes.rows[0];
      await pool.query(`DELETE FROM listing_images WHERE id = $1`, [imageId]);

      // If we deleted the cover, ensure another cover exists
      if (img.is_cover) {
        const coverExistsRes = await pool.query(
          `SELECT 1 FROM listing_images WHERE listing_id = $1 AND is_cover = true LIMIT 1`,
          [listingId]
        );
        if (coverExistsRes.rowCount === 0) {
          const nextRes = await pool.query(
            `SELECT id FROM listing_images WHERE listing_id = $1 ORDER BY uploaded_at ASC LIMIT 1`,
            [listingId]
          );
          if (nextRes.rowCount > 0) {
            await pool.query(
              `UPDATE listing_images SET is_cover = true WHERE id = $1`,
              [nextRes.rows[0].id]
            );
          }
        }
      }

      await pool.query("COMMIT");

      // Best-effort S3 delete after DB commit
      const key = img.image_url;
      if (
        key &&
        typeof key === "string" &&
        !key.startsWith("http") &&
        !key.startsWith("blob:")
      ) {
        try {
          await deleteImage(key);
        } catch (err) {
          console.error("Failed to delete listing image from S3:", err);
        }
      }

      return res.json({ ok: true });
    } catch (err) {
      try {
        await pool.query("ROLLBACK");
      } catch {
        // ignore
      }
      console.error("DELETE /listings/:listingId/images/:imageId error:", err);
      return res.status(500).json({ error: "Database error." });
    }
  }
);

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
      // image.url should be the S3 key (e.g., "listings/1234567890-filename.jpg")
      // We'll store the S3 key, and generate view URLs when needed
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
    const hasAvatar = await usersHasProfileImageKeyColumn();
    const selectAvatar = hasAvatar ? ", u.profile_image_key" : "";

    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.college, u.created_at, u.is_verified, u.username, d.name as dorm_name${selectAvatar}
       FROM users u 
       LEFT JOIN dorms d ON u.dorm_id = d.id 
       WHERE u.id = $1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("User not found.");
    }

    const profile = result.rows[0];
    if (hasAvatar && profile.profile_image_key) {
      try {
        profile.profile_image_url = await generateViewURL(
          profile.profile_image_key
        );
      } catch (err) {
        console.error("Error generating profile image URL:", err);
        profile.profile_image_url = null;
      }
    } else {
      profile.profile_image_url = null;
    }

    res.json(profile);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error.");
  }
});

// Get a public user's profile data by ID (does NOT return email)
app.get("/profile/:id", jwtMiddleware, async (req, res) => {
  const { id } = req.params;

  try {
    const hasAvatar = await usersHasProfileImageKeyColumn();
    const selectAvatar = hasAvatar ? ", u.profile_image_key" : "";

    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.college, u.created_at, u.is_verified, u.username, d.name as dorm_name${selectAvatar}
       FROM users u
       LEFT JOIN dorms d ON u.dorm_id = d.id
       WHERE u.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("User not found.");
    }

    const profile = result.rows[0];
    if (hasAvatar && profile.profile_image_key) {
      try {
        profile.profile_image_url = await generateViewURL(
          profile.profile_image_key
        );
      } catch (err) {
        console.error("Error generating public profile image URL:", err);
        profile.profile_image_url = null;
      }
    } else {
      profile.profile_image_url = null;
    }

    res.json(profile);
  } catch (err) {
    console.error("Error fetching public profile:", err);
    res.status(500).send("Database error.");
  }
});

// Save current user's profile picture key (stored in S3 under profiles/<userId>/...)
app.patch("/profile/avatar", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { profile_image_key } = req.body || {};

  try {
    const hasAvatar = await usersHasProfileImageKeyColumn();
    if (!hasAvatar) {
      return res
        .status(500)
        .send(
          "Database missing users.profile_image_key column. Run the migration to add it."
        );
    }

    if (
      !profile_image_key ||
      typeof profile_image_key !== "string" ||
      !profile_image_key.startsWith(`profiles/${user_id}/`)
    ) {
      return res
        .status(400)
        .send(
          "Invalid profile_image_key (must be under your profiles/<id>/ prefix)."
        );
    }

    // Delete previous avatar if exists (best-effort)
    const previous = await pool.query(
      `SELECT profile_image_key FROM users WHERE id = $1`,
      [user_id]
    );
    const oldKey = previous.rows[0]?.profile_image_key;

    await pool.query(`UPDATE users SET profile_image_key = $1 WHERE id = $2`, [
      profile_image_key,
      user_id,
    ]);

    if (oldKey && oldKey !== profile_image_key) {
      try {
        await deleteImage(oldKey);
      } catch (err) {
        console.error("Failed to delete old profile image:", err);
      }
    }

    const profile_image_url = await generateViewURL(profile_image_key);
    return res.status(200).json({ profile_image_key, profile_image_url });
  } catch (err) {
    console.error("Error saving profile avatar:", err);
    return res.status(500).send("Database error.");
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

// Get all categories
app.get("/categories", jwtMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name FROM categories ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error.");
  }
});

// AI: recommend listing description from uploaded images (via ml-service)
app.post("/ai/listing-description", jwtMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { image_keys, title_hint, category_hints, max_images } =
      req.body || {};

    const rl = canRequestAI(user_id, { limit: 10, windowMs: 60 * 60 * 1000 }); // 10/hour
    if (!rl.ok) {
      return res
        .status(429)
        .json({ error: "Too many AI requests. Please try again later." });
    }

    if (!Array.isArray(image_keys) || image_keys.length < 1) {
      return res.status(400).json({ error: "image_keys is required." });
    }

    const limit = Math.max(
      1,
      Math.min(6, Number.isFinite(max_images) ? max_images : 1)
    );
    const keys = image_keys
      .filter((k) => typeof k === "string" && k.trim())
      .slice(0, limit);
    if (keys.length < 1) {
      return res.status(400).json({ error: "No valid image_keys provided." });
    }

    // Generate short-lived view URLs for the microservice.
    const image_urls = await Promise.all(
      keys.map(async (k) => {
        try {
          return await generateViewURL(k);
        } catch (err) {
          console.error("AI generateViewURL error:", err);
          return null;
        }
      })
    );

    const filteredUrls = image_urls.filter((u) => typeof u === "string" && u);
    if (filteredUrls.length < 1) {
      return res.status(400).json({ error: "Failed to generate image URLs." });
    }

    const mlBase = process.env.ML_SERVICE_URL || "http://localhost:8000";
    const mlBaseTrimmed = mlBase.endsWith("/") ? mlBase.slice(0, -1) : mlBase;
    const mlUrl = `${mlBaseTrimmed}/ml/analyze-listing`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    let mlRes;
    try {
      mlRes = await fetch(mlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_urls: filteredUrls,
          title_hint: typeof title_hint === "string" ? title_hint : null,
          category_hints: Array.isArray(category_hints)
            ? category_hints.filter((x) => typeof x === "string")
            : null,
          // Default provider is configured in ml-service env; can be overridden there.
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!mlRes?.ok) {
      const t = mlRes ? await mlRes.text() : "No response";
      return res.status(502).json({ error: "ML service error", detail: t });
    }

    const data = await mlRes.json();
    const description = data?.description;
    if (!description || typeof description !== "string") {
      return res.status(502).json({ error: "Invalid ML response" });
    }

    return res.status(200).json({
      description,
      provider: data?.provider,
      model: data?.model,
      remaining: rl.remaining,
    });
  } catch (err) {
    const msg =
      err?.name === "AbortError" ? "ML service timed out" : err?.message;
    console.error("POST /ai/listing-description error:", err);
    return res.status(500).json({ error: msg || "AI error" });
  }
});

// AI: recommend a listing price range based on images + eBay Browse API comps (via ml-service)
app.post("/ai/listing-price", jwtMiddleware, async (req, res) => {
  try {
    const user_id = req.user.id;
    const { image_keys, title_hint, category_hints, max_images } =
      req.body || {};

    const rl = canRequestAI(user_id, { limit: 10, windowMs: 60 * 60 * 1000 }); // 10/hour
    if (!rl.ok) {
      return res
        .status(429)
        .json({ error: "Too many AI requests. Please try again later." });
    }

    if (!Array.isArray(image_keys) || image_keys.length < 1) {
      return res.status(400).json({ error: "image_keys is required." });
    }

    const limit = Math.max(
      1,
      Math.min(6, Number.isFinite(max_images) ? max_images : 1)
    );
    const keys = image_keys
      .filter((k) => typeof k === "string" && k.trim())
      .slice(0, limit);
    if (keys.length < 1) {
      return res.status(400).json({ error: "No valid image_keys provided." });
    }

    const image_urls = await Promise.all(
      keys.map(async (k) => {
        try {
          return await generateViewURL(k);
        } catch (err) {
          console.error("AI price generateViewURL error:", err);
          return null;
        }
      })
    );
    const filteredUrls = image_urls.filter((u) => typeof u === "string" && u);
    if (filteredUrls.length < 1) {
      return res.status(400).json({ error: "Failed to generate image URLs." });
    }

    const mlBase = process.env.ML_SERVICE_URL || "http://localhost:8000";
    const mlBaseTrimmed = mlBase.endsWith("/") ? mlBase.slice(0, -1) : mlBase;
    const mlUrl = `${mlBaseTrimmed}/ml/recommend-price`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    let mlRes;
    try {
      mlRes = await fetch(mlUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_urls: filteredUrls,
          title_hint: typeof title_hint === "string" ? title_hint : null,
          category_hints: Array.isArray(category_hints)
            ? category_hints.filter((x) => typeof x === "string")
            : null,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!mlRes?.ok) {
      const t = mlRes ? await mlRes.text() : "No response";
      return res.status(502).json({ error: "ML service error", detail: t });
    }

    const data = await mlRes.json();
    return res.status(200).json({ ...data, remaining: rl.remaining });
  } catch (err) {
    const msg =
      err?.name === "AbortError" ? "ML service timed out" : err?.message;
    console.error("POST /ai/listing-price error:", err);
    return res.status(500).json({ error: msg || "AI error" });
  }
});

// Get individual listing by ID
app.get("/listing/:id", jwtMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;

    // First, get the listing basic info
    const hasIsSold = await listingsHasIsSoldColumn();
    const selectIsSold = hasIsSold ? ", l.is_sold" : ", false as is_sold";

    const listingResult = await pool.query(
      `SELECT 
        l.id, l.title, l.price, l.description, l.posted_at, l.user_id${selectIsSold},
        u.first_name, u.last_name, u.username, u.college,
        d.name as dorm_name
      FROM listings l
      LEFT JOIN users u ON l.user_id = u.id
      LEFT JOIN dorms d ON u.dorm_id = d.id
      WHERE l.id = $1`,
      [id]
    );

    if (listingResult.rows.length === 0) {
      return res.status(404).send("Listing not found.");
    }

    const listing = listingResult.rows[0];

    // Favorites (optional): only if saved_listings table exists
    let is_saved = false;
    try {
      const savedExists = await pool.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_listings' LIMIT 1`
      );
      if (savedExists.rowCount > 0) {
        const savedRes = await pool.query(
          `SELECT 1 FROM saved_listings WHERE user_id = $1 AND listing_id = $2 LIMIT 1`,
          [user_id, id]
        );
        is_saved = savedRes.rowCount > 0;
      }
    } catch (err) {
      // ignore (keep false)
    }
    listing.is_saved = is_saved;

    // Get categories separately
    const categoriesResult = await pool.query(
      `SELECT c.name
       FROM listing_categories lc
       JOIN categories c ON lc.category_id = c.id
       WHERE lc.listing_id = $1`,
      [id]
    );
    listing.categories = categoriesResult.rows.map((row) => row.name);

    // Get images separately
    const imagesResult = await pool.query(
      `SELECT id, image_url, is_cover
       FROM listing_images
       WHERE listing_id = $1
       ORDER BY is_cover DESC, uploaded_at ASC`,
      [id]
    );

    // Convert S3 keys to viewable URLs for images
    listing.images = await Promise.all(
      imagesResult.rows.map(async (img) => {
        const imageUrl = img.image_url;

        // Skip blob URLs (legacy)
        if (!imageUrl || imageUrl.startsWith("blob:")) {
          return null;
        }

        // If it's already a full URL (legacy), return as-is
        if (imageUrl.startsWith("http")) {
          return {
            id: img.id,
            image_url: imageUrl,
            is_cover: img.is_cover,
          };
        }

        // If it's an S3 key, generate presigned URL
        try {
          const viewURL = await generateViewURL(imageUrl);
          return {
            id: img.id,
            image_url: viewURL,
            is_cover: img.is_cover,
          };
        } catch (err) {
          console.error("Error generating image URL:", err);
          return {
            id: img.id,
            image_url: null,
            is_cover: img.is_cover,
          };
        }
      })
    );

    // Filter out null images
    listing.images = listing.images.filter((img) => img !== null);

    res.json(listing);
  } catch (err) {
    console.error("Error fetching listing:", err);
    res.status(500).send("Database error.");
  }
});

// S3 endpoints
// Get presigned upload URL for a single image
app.get("/s3/upload-url", jwtMiddleware, async (req, res) => {
  try {
    const { filename, contentType } = req.query;
    if (!filename || !contentType) {
      return res.status(400).json({
        error: "Missing required query params: filename, contentType",
      });
    }
    const { uploadURL, key } = await generateUploadURL(filename, contentType);
    return res.json({ uploadURL, key });
  } catch (err) {
    console.error("/s3/upload-url error:", err);
    return res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Get presigned upload URL for a profile image (stored under profiles/<userId>/...)
app.get("/s3/profile-upload-url", jwtMiddleware, async (req, res) => {
  try {
    const { filename, contentType } = req.query;
    if (!filename || !contentType) {
      return res.status(400).json({
        error: "Missing required query params: filename, contentType",
      });
    }

    const { uploadURL, key } = await generateProfileUploadURL(
      req.user.id,
      filename,
      contentType
    );
    return res.json({ uploadURL, key });
  } catch (err) {
    console.error("/s3/profile-upload-url error:", err);
    const errorMessage =
      err.message ||
      "Failed to generate upload URL for profile picture. Check AWS configuration.";
    return res.status(500).json({ error: errorMessage });
  }
});

// Get multiple presigned upload URLs (for batch uploads)
app.post("/s3/upload-urls", jwtMiddleware, async (req, res) => {
  try {
    const { files } = req.body; // Array of { filename, contentType }
    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        error: "Missing or invalid files array",
      });
    }
    if (files.length > 6) {
      return res.status(400).json({
        error: "Maximum 6 files allowed",
      });
    }

    const uploadUrls = await Promise.all(
      files.map((file) =>
        generateUploadURL(file.filename, file.contentType).then((result) => ({
          uploadURL: result.uploadURL,
          key: result.key,
        }))
      )
    );

    return res.json({ uploadUrls });
  } catch (err) {
    console.error("/s3/upload-urls error:", err);
    const errorMessage =
      err.message || "Failed to generate upload URLs. Check AWS configuration.";
    return res.status(500).json({
      error: errorMessage,
      details: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }
});

app.get("/s3/test-view-url", jwtMiddleware, async (req, res) => {
  try {
    const { key } = req.query;
    if (!key) {
      return res
        .status(400)
        .json({ error: "Missing required query param: key" });
    }
    const viewURL = await generateViewURL(key);
    return res.json({ viewURL });
  } catch (err) {
    console.error("/s3/test-view-url error:", err);
    return res.status(500).json({ error: "Failed to generate view URL" });
  }
});

// -----------------------------
// Messaging (Conversations + Messages)
// -----------------------------

// Create (or fetch) a conversation for a listing between current user (buyer) and the listing owner (seller)
app.post("/conversations", jwtMiddleware, async (req, res) => {
  const buyer_id = req.user.id;
  const { listing_id } = req.body || {};

  if (!listing_id) {
    return res.status(400).json({ error: "listing_id is required" });
  }

  try {
    const listingRes = await pool.query(
      `SELECT id, title, user_id FROM listings WHERE id = $1`,
      [listing_id]
    );
    if (listingRes.rows.length === 0) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const listing = listingRes.rows[0];
    const seller_id = listing.user_id;

    if (seller_id === buyer_id) {
      return res.status(400).json({ error: "You cannot message yourself." });
    }

    // Create conversation (or get existing)
    const convoRes = await pool.query(
      `INSERT INTO conversations (listing_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (listing_id, buyer_id, seller_id)
       DO UPDATE SET listing_id = EXCLUDED.listing_id
       RETURNING id, listing_id, buyer_id, seller_id, created_at`,
      [listing_id, buyer_id, seller_id]
    );

    return res.status(200).json({
      conversation: {
        ...convoRes.rows[0],
        listing_title: listing.title,
      },
    });
  } catch (err) {
    console.error("POST /conversations error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

// List conversations for current user (inbox)
app.get("/conversations", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;

  try {
    const hasReads = await conversationsHasReadColumns();

    const result = await pool.query(
      `
      SELECT
        c.id,
        c.listing_id,
        l.title AS listing_title,
        (
          SELECT image_url
          FROM listing_images
          WHERE listing_id = l.id AND is_cover = true
          LIMIT 1
        ) AS listing_cover_key,
        c.buyer_id,
        c.seller_id,
        CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END AS other_user_id,
        u.username AS other_username,
        u.first_name AS other_first_name,
        u.last_name AS other_last_name,
        u.profile_image_key AS other_profile_image_key,
        lm.body AS last_message_body,
        lm.created_at AS last_message_at,
        ${
          hasReads
            ? `(
          SELECT COUNT(*)
          FROM messages m
          WHERE m.conversation_id = c.id
            AND m.sender_id <> $1
            AND m.created_at > COALESCE(
              CASE WHEN c.buyer_id = $1 THEN c.last_read_at_buyer ELSE c.last_read_at_seller END,
              TIMESTAMP '1970-01-01'
            )
        )::int AS unread_count`
            : "0::int AS unread_count"
        }
      FROM conversations c
      JOIN listings l ON l.id = c.listing_id
      JOIN users u ON u.id = CASE WHEN c.buyer_id = $1 THEN c.seller_id ELSE c.buyer_id END
      LEFT JOIN LATERAL (
        SELECT body, created_at
        FROM messages
        WHERE conversation_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
      ) lm ON true
      WHERE c.buyer_id = $1 OR c.seller_id = $1
      ORDER BY lm.created_at DESC NULLS LAST, c.created_at DESC
      `,
      [user_id]
    );

    const convos = await Promise.all(
      result.rows.map(async (row) => {
        const convo = { ...row };

        // listing cover
        convo.listing_cover_url = null;
        if (
          convo.listing_cover_key &&
          !convo.listing_cover_key.startsWith("http")
        ) {
          try {
            convo.listing_cover_url = await generateViewURL(
              convo.listing_cover_key
            );
          } catch (err) {
            console.error("Error generating listing cover URL:", err);
          }
        } else if (convo.listing_cover_key) {
          convo.listing_cover_url = convo.listing_cover_key;
        }

        // other user's profile image
        convo.other_profile_image_url = null;
        if (convo.other_profile_image_key) {
          try {
            convo.other_profile_image_url = await generateViewURL(
              convo.other_profile_image_key
            );
          } catch (err) {
            console.error("Error generating other profile image URL:", err);
          }
        }

        // cleanup raw keys
        delete convo.listing_cover_key;

        return convo;
      })
    );

    return res.json({ conversations: convos });
  } catch (err) {
    console.error("GET /conversations error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

// Total unread count across all conversations (for global badges)
app.get("/conversations/unread-count", jwtMiddleware, async (req, res) => {
  try {
    const total_unread = await computeUnreadTotal(req.user.id);
    return res.json({ total_unread });
  } catch (err) {
    console.error("GET /conversations/unread-count error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

// Get messages for a conversation (thread view)
app.get("/conversations/:id/messages", jwtMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { id: conversation_id } = req.params;

  try {
    const hasReads = await conversationsHasReadColumns();
    const convoRes = await pool.query(
      `SELECT id, listing_id, buyer_id, seller_id${
        hasReads ? ", last_read_at_buyer, last_read_at_seller" : ""
      }
       FROM conversations
       WHERE id = $1`,
      [conversation_id]
    );
    if (convoRes.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const convo = convoRes.rows[0];
    if (convo.buyer_id !== user_id && convo.seller_id !== user_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    // Mark as read when opening the thread (best-effort)
    let current_last_read_at = null;
    let other_last_read_at = null;
    if (hasReads) {
      const isBuyer = convo.buyer_id === user_id;
      const now = new Date();
      current_last_read_at = now.toISOString();
      other_last_read_at = isBuyer
        ? convo.last_read_at_seller
        : convo.last_read_at_buyer;
      try {
        await pool.query(
          `UPDATE conversations
           SET ${isBuyer ? "last_read_at_buyer" : "last_read_at_seller"} = $1
           WHERE id = $2`,
          [now, conversation_id]
        );
      } catch (err) {
        console.error("Failed to update last_read_at:", err);
      }

      // Realtime updates: read receipts + unread totals
      const otherUserId = isBuyer ? convo.seller_id : convo.buyer_id;
      emitToUser(otherUserId, "read", {
        conversation_id,
        reader_id: user_id,
        read_at: now.toISOString(),
      });
      await emitUnreadTotal(user_id);
      await emitUnreadTotal(otherUserId);
    }

    const listingRes = await pool.query(
      `SELECT id, title FROM listings WHERE id = $1`,
      [convo.listing_id]
    );
    const listing_title = listingRes.rows[0]?.title || "";

    const msgsRes = await pool.query(
      `SELECT m.id, m.sender_id, m.body, m.created_at,
              u.username, u.first_name, u.last_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversation_id]
    );

    return res.json({
      conversation: {
        id: convo.id,
        listing_id: convo.listing_id,
        listing_title,
        buyer_id: convo.buyer_id,
        seller_id: convo.seller_id,
        current_user_id: user_id,
        other_user_id:
          convo.buyer_id === user_id ? convo.seller_id : convo.buyer_id,
        other_last_read_at: other_last_read_at
          ? new Date(other_last_read_at).toISOString()
          : null,
        current_last_read_at,
      },
      messages: msgsRes.rows,
    });
  } catch (err) {
    console.error("GET /conversations/:id/messages error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});

// Send a message in a conversation
app.post("/conversations/:id/messages", jwtMiddleware, async (req, res) => {
  const sender_id = req.user.id;
  const { id: conversation_id } = req.params;
  const { body } = req.body || {};

  if (!body || typeof body !== "string" || body.trim().length === 0) {
    return res.status(400).json({ error: "Message body is required." });
  }

  try {
    const convoRes = await pool.query(
      `SELECT id, buyer_id, seller_id
       FROM conversations
       WHERE id = $1`,
      [conversation_id]
    );
    if (convoRes.rows.length === 0) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    const convo = convoRes.rows[0];
    if (convo.buyer_id !== sender_id && convo.seller_id !== sender_id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const msgRes = await pool.query(
      `INSERT INTO messages (conversation_id, sender_id, body)
       VALUES ($1, $2, $3)
       RETURNING id, conversation_id, sender_id, body, created_at`,
      [conversation_id, sender_id, body.trim()]
    );

    const message = msgRes.rows[0];

    // include sender info (helpful for clients)
    try {
      const senderRes = await pool.query(
        `SELECT username, first_name, last_name FROM users WHERE id = $1`,
        [sender_id]
      );
      const s = senderRes.rows[0];
      if (s) {
        message.username = s.username;
        message.first_name = s.first_name;
        message.last_name = s.last_name;
      }
    } catch {
      // ignore
    }

    // Realtime updates: deliver message event to both participants + update unread totals
    const otherUserId =
      convo.buyer_id === sender_id ? convo.seller_id : convo.buyer_id;
    emitToUser(sender_id, "message", { conversation_id, message });
    emitToUser(otherUserId, "message", { conversation_id, message });
    await emitUnreadTotal(sender_id);
    await emitUnreadTotal(otherUserId);

    return res.status(201).json({ message });
  } catch (err) {
    console.error("POST /conversations/:id/messages error:", err);
    return res.status(500).json({ error: "Database error." });
  }
});
