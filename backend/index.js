const express = require("express");
const pool = require("./db");
const bcrypt = require("bcrypt");
const cors = require("cors");

require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// app.get("/ping", (req, res) => {
//   res.send("pong");
// });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// app.get("/db-test", async (req, res) => {
//   try {
//     const result = await pool.query("SELECT NOW()");
//     res.send(result.rows[0]);
//   } catch (err) {
//     console.error(err);
//     res.status(500).send("Database error");
//   }
// });

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
    res.status(500).send("Account already exists, please log in!");
  }
});

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
    res.status(401).send("User does not exist.");
  }
});
