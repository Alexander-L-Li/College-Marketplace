const express = require("express");
const app = express();
const pool = require("./db");
const bcrypt = require("bcrypt");

require("dotenv").config();
app.use(express.json());

const PORT = process.env.PORT || 3001;

app.get("/ping", (req, res) => {
  res.send("pong");
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.send(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).send("Database error");
  }
});

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
    res.status(500).send("Registration failed");
  }
});
