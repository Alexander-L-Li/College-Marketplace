# 🧠 Dorm Drop (Dorm Space) – Full Project Context & TODOs

## 🧭 Overview

**Dorm Drop** is a full-stack marketplace app for college students to buy/sell dorm essentials. You are building it to learn deeply and ship a scalable, production-grade app by the end of Summer 2025.

**Primary Goals:**

- Strengthen internship applications for Summer 2026
- Master React, Tailwind, Node, FastAPI, SQL, Docker
- Build for real-world scalability and deployment

---

## 🧱 Tech Stack

- **Frontend:** React.js, Tailwind CSS (mobile-first), lovable.dev
- **Backend:** Node.js + Express (API), FastAPI (future AI/ML microservices)
- **Database:** PostgreSQL (local now, Supabase planned)
- **Storage:** AWS S3 (image uploads)
- **Email:** Gmail SMTP via NodeMailer (free email delivery)
- **Infra:** Docker (containers), CI/CD planned

---

## ✅ Completed Labs & Features

### Core Labs

- ✅ Project folder + React setup
- ✅ Tailwind CSS config (mobile-first)
- ✅ Login/Register UI with single landing page
- ✅ Home page layout with listings + search
- ✅ Local PostgreSQL setup
- ✅ Rebuilt `users` and `listings` tables with enums

### Listings & Images

- ✅ `listing_images` table (`is_cover` boolean model)
- ✅ AWS S3 image upload support (not Supabase Storage)

### Auth & Security

- ✅ Password reset (UUID tokens, email, expiration)
- ✅ Rate limiting (in-memory)
- ✅ Forgot password UI
- ✅ Reset password UI
- ✅ Email verification system (6-digit code)
- ✅ `/verify-email` and `/resend-verification` routes
- ✅ Email verification UI w/ cooldown and redirect

---

## 🔮 Future Labs (Planned)

### 🧾 Authentication Labs

- [ ] Add token expiration handling to `/verify-email`
- [ ] Rate limit `/resend-verification`
- [ ] Animate Confirm Password field (only shows when typing)
- [ ] Split login & registration into `/login` and `/signup` pages
- [ ] Support “Sign in with Google” & “Sign in with Apple”
- [ ] Email verification success page

### 💬 Messaging System (Lab 18)

- [ ] Design conversations table schema
- [ ] Implement inbox view (efficient querying)
- [ ] Build message thread view
- [ ] Add new message API
- [ ] Add read receipts

### 🖼️ Listings Page (Home Feed)

- [ ] Fetch all listings from DB on load
- [ ] Display cover image thumbnail
- [ ] Add search bar with keyword filtering
- [ ] Sort dropdown (price/name/date)
- [ ] Display carousel for multiple images per listing

### 🧠 Discover Page (Future)

- [ ] Featured listings
- [ ] Trending categories
- [ ] Nearby campus deals (geo support optional)

### 🤝 Social Features (Post-MVP)

- [ ] Add friending system
- [ ] Allow comments on listings
- [ ] Likes/upvotes system

---

## 📦 Deployment & Infra

### Database

- [ ] Migrate from local Postgres to Supabase
- [ ] Backup DB schema and seed test data

### DevOps

- [ ] Create Docker Compose for local development
- [ ] Setup NGINX reverse proxy for Express + FastAPI
- [ ] Setup GitHub Actions CI/CD
- [ ] Choose host (Railway / Fly.io / Render)

### Production Hosting

- [ ] Vercel for frontend
- [ ] AWS S3 for image hosting
- [ ] Backend deployed via container host

---

## 📱 Native App (Future)

- [ ] Convert web app to Swift iOS app
- [ ] Mobile app connects to same REST API
- [ ] Add iOS-style UI with native auth

---

## 🧠 Scalability & Engineering Philosophy

- ✅ Using PostgreSQL for performance and relationships
- ✅ Rate limiting on sensitive endpoints
- ✅ Tokens expire (email, password reset)
- [ ] Index search/filter columns
- [ ] Optimize query joins (eager loading)
- [ ] Introduce Redis (future) for sessions/caching
- [ ] Use FastAPI microservices for ML/image features

---

## 📬 Email System Summary

- ✅ Gmail SMTP (NodeMailer)
- ✅ Password reset flow (with expiration)
- ✅ 6-digit email verification codes
- ✅ Email resend cooldown
- [ ] Move to production email (e.g., Mailgun or SES later)

---

## 🧾 Schema Overview

### `users`

- id (UUID)
- full_name
- email
- password_hash
- is_verified
- created_at

### `email_verification_codes`

- id
- user_id (FK)
- code (6-digit)
- expires_at

### `password_reset_tokens`

- id
- user_id (FK)
- token (UUID)
- expires_at

### `listings`

- id
- title
- description
- category (enum)
- price
- user_id (FK)
- created_at

### `listing_images`

- id
- listing_id (FK)
- image_url
- is_cover (boolean)

---

## 📊 Database Schema (as of June 2024)

### users

| Column     | Type    | Nullable | Default                           | Description       |
| ---------- | ------- | -------- | --------------------------------- | ----------------- |
| id         | integer | not null | nextval('users_id_seq'::regclass) | Primary key       |
| first_name | text    | not null |                                   | User’s first name |
| last_name  | text    | not null |                                   | User’s last name  |
| email      | text    | not null |                                   | User’s email      |
| college    | text    | not null |                                   | User’s college    |

---

### listings

| Column      | Type          | Nullable | Default                              | Description           |
| ----------- | ------------- | -------- | ------------------------------------ | --------------------- |
| id          | integer       | not null | nextval('listings_id_seq'::regclass) | Primary key           |
| name        | text          | not null |                                      | Listing title         |
| price       | numeric(10,2) | not null |                                      | Listing price         |
| description | text          | not null |                                      | Listing description   |
| posted_at   | timestamp     | not null | CURRENT_TIMESTAMP                    | Time posted           |
| college     | text          | not null | 'mit'::text                          | College (default MIT) |

Indexes:

- listings_pkey PRIMARY KEY (id)

Referenced by:

- listing_categories (listing_id foreign key)
- listing_images (listing_id foreign key)

---

### listing_images

| Column      | Type      | Nullable | Default                                    | Description        |
| ----------- | --------- | -------- | ------------------------------------------ | ------------------ |
| id          | integer   | not null | nextval('listing_images_id_seq'::regclass) | Primary key        |
| listing_id  | integer   |          |                                            | FK to listings(id) |
| image_url   | text      | not null |                                            | Image URL          |
| uploaded_at | timestamp | not null | CURRENT_TIMESTAMP                          | Upload time        |
| is_cover    | boolean   | not null | false                                      | Is cover image     |

Indexes:

- listing_images_pkey PRIMARY KEY (id)

Foreign-key constraints:

- listing_id REFERENCES listings(id) ON DELETE CASCADE

---

### password_reset_tokens

| Column     | Type                     | Nullable | Default                                           | Description       |
| ---------- | ------------------------ | -------- | ------------------------------------------------- | ----------------- |
| id         | integer                  | not null | nextval('password_reset_tokens_id_seq'::regclass) | Primary key       |
| user_id    | integer                  | not null |                                                   | FK to users(id)   |
| token      | text                     | not null |                                                   | Reset token       |
| expires_at | timestamp with time zone | not null |                                                   | Expiration time   |
| used       | boolean                  |          | false                                             | If token was used |

Indexes:

- password_reset_tokens_pkey PRIMARY KEY (id)

Foreign-key constraints:

- user_id REFERENCES users(id) ON DELETE CASCADE

---

### email_verification_codes

- **Not found in your DB yet!**  
  (You’ll need to create this table as discussed in previous steps.)

---

## 🛠️ Discovered Gaps & TODOs (as of June 8, 2024)

### Backend

- [ ] Implement `/verify-email` and `/resend-verification` endpoints.
- [ ] On registration, generate and email a 6-digit verification code, and create an entry in `email_verification_codes`.
- [ ] Add rate limiting to `/resend-verification` and `/verify-email` endpoints.
- [ ] Replace fake session token in `/login` with JWT or real session management.

### Frontend

- [ ] After successful registration, navigate user to `/EmailVerification` with their email as a query param.
- [ ] Split login and registration into separate `/login` and `/signup` routes for clarity and better UX.

### General

- [ ] Ensure all required fields (e.g., `college`) are always available and validated in both frontend and backend.

---

## 🛣️ Immediate TODOs

### Backend

- [ ] Finalize `/verify-email` logic (code checking, expiry)
- [ ] Add rate limit + cooldown to `/resend-verification`

### Frontend

- [ ] Navigate to EmailVerification after successful signup
- [ ] Animate Confirm Password on password input change
- [ ] Show verification success message after valid entry
- [ ] Create separate `/login` and `/signup` routes

---

## ☑️ Cursor Dev Strategy

- Use this file as your **central dev hub**
- Convert sections to files, checklists, or side notes
- Use `// TODO:` and `// NOTE:` comments in code to track progress

### 2. Learning-Based Lab: Email Verification & Auth Improvements

#### **Lab Title:**

Implementing Secure Email Verification and Session Management

#### **Lab Goals:**

- Deepen your understanding of backend authentication flows in Node.js/Express.
- Practice designing and implementing secure, scalable endpoints.
- Learn to integrate backend logic with frontend flows.

#### **Lab Steps & Guiding Questions**

---

#### **Step 1: Email Verification Code Generation**

- **Goal:** When a user registers, generate a 6-digit code, store it in the DB, and email it to the user.
- **Questions to Consider:**
  - How will you generate a secure, random 6-digit code in JavaScript?
  - How will you structure the `email_verification_codes` table and ensure codes expire?
  - How will you send the code using your existing `sendEmail` utility?
- **Checkpoint:**
  - After registration, check your DB for a new code and confirm the user receives an email.

---

#### **Step 2: `/verify-email` Endpoint**

- **Goal:** Create an endpoint that checks the code, marks the user as verified, and handles expiration.
- **Questions to Consider:**
  - How will you query for the code and check its expiration?
  - How will you update the user’s `is_verified` status?
  - What error responses should you return for invalid, expired, or already-used codes?
- **Checkpoint:**
  - Test with valid, invalid, and expired codes. What responses do you get?

---

#### **Step 3: `/resend-verification` Endpoint with Rate Limiting**

- **Goal:** Allow users to request a new code, but rate-limit requests to prevent abuse.
- **Questions to Consider:**
  - How will you implement rate limiting for this endpoint? (Can you reuse your existing logic?)
  - How will you handle resending codes for already-verified users?
  - How will you update or replace old codes in the DB?
- **Checkpoint:**
  - Try resending codes multiple times—does the rate limit work? Are codes updated in the DB?

---

#### **Step 4: JWT Session Management**

- **Goal:** Replace the fake session token in `/login` with a real JWT.
- **Questions to Consider:**
  - What information should you include in the JWT payload?
  - How will you sign and verify JWTs securely?
  - How will you handle token expiration and invalidation?
- **Checkpoint:**
  - After login, inspect the JWT. Can you decode it? Does it contain the right info?

---

#### **Step 5: Frontend Integration**

- **Goal:** Update the frontend to navigate to `/EmailVerification`
