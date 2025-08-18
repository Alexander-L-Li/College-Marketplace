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
- ✅ JWT Session Management (token signing, verification, middleware)
- ✅ Frontend JWT integration (storage, expiration checks, protected routes)
- ✅ Username system (registration, profile updates, display in listings)

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

| Column      | Type        | Nullable | Default            | Description        |
| ----------- | ----------- | -------- | ------------------ | ------------------ |
| id          | UUID        | not null | uuid_generate_v4() | Primary key        |
| first_name  | text        | not null |                    | User's first name  |
| last_name   | text        | not null |                    | User's last name   |
| username    | varchar(30) | not null |                    | Unique username    |
| email       | text        | not null |                    | User's email       |
| college     | text        | not null |                    | User's college     |
| password    | text        | not null |                    | Hashed password    |
| created_at  | timestamp   |          | CURRENT_TIMESTAMP  | Account creation   |
| is_verified | boolean     | not null | false              | Email verification |

Indexes:

- users_pkey PRIMARY KEY (id)
- users_email_unique UNIQUE CONSTRAINT (email)
- users_username_key UNIQUE CONSTRAINT (username)

Referenced by:

- email_verification_codes (user_id foreign key)
- password_reset_tokens (user_id foreign key)
- listings (user_id foreign key)

---

### listings

| Column      | Type          | Nullable | Default            | Description           |
| ----------- | ------------- | -------- | ------------------ | --------------------- |
| id          | UUID          | not null | uuid_generate_v4() | Primary key           |
| title       | text          | not null |                    | Listing title         |
| price       | numeric(10,2) | not null |                    | Listing price         |
| description | text          | not null |                    | Listing description   |
| posted_at   | timestamp     | not null | CURRENT_TIMESTAMP  | Time posted           |
| college     | text          | not null | 'mit'::text        | College (default MIT) |
| user_id     | UUID          |          |                    | FK to users(id)       |
| category    | text          |          |                    | Listing category      |

Indexes:

- listings_pkey PRIMARY KEY (id)

Foreign-key constraints:

- user_id REFERENCES users(id) ON DELETE CASCADE

Referenced by:

- listing_categories (listing_id foreign key)
- listing_images (listing_id foreign key)

---

### listing_images

| Column      | Type      | Nullable | Default            | Description        |
| ----------- | --------- | -------- | ------------------ | ------------------ |
| id          | UUID      | not null | uuid_generate_v4() | Primary key        |
| listing_id  | UUID      |          |                    | FK to listings(id) |
| image_url   | text      | not null |                    | Image URL          |
| uploaded_at | timestamp | not null | CURRENT_TIMESTAMP  | Upload time        |
| is_cover    | boolean   | not null | false              | Is cover image     |

Indexes:

- listing_images_pkey PRIMARY KEY (id)

Foreign-key constraints:

- listing_id REFERENCES listings(id) ON DELETE CASCADE

---

### listing_categories

| Column      | Type | Nullable | Default | Description          |
| ----------- | ---- | -------- | ------- | -------------------- |
| listing_id  | UUID | not null |         | FK to listings(id)   |
| category_id | UUID | not null |         | FK to categories(id) |

Indexes:

- listing_categories_pkey PRIMARY KEY (listing_id, category_id)

Foreign-key constraints:

- listing_id REFERENCES listings(id) ON DELETE CASCADE
- category_id REFERENCES categories(id) ON DELETE CASCADE

---

### categories

| Column | Type | Nullable | Default            | Description   |
| ------ | ---- | -------- | ------------------ | ------------- |
| id     | UUID | not null | uuid_generate_v4() | Primary key   |
| name   | text | not null |                    | Category name |

Indexes:

- categories_pkey PRIMARY KEY (id)
- categories_name_key UNIQUE CONSTRAINT (name)

Referenced by:

- listing_categories (category_id foreign key)

---

### password_reset_tokens

| Column     | Type                     | Nullable | Default            | Description       |
| ---------- | ------------------------ | -------- | ------------------ | ----------------- |
| token      | UUID                     | not null | uuid_generate_v4() | Primary key       |
| user_id    | UUID                     |          |                    | FK to users(id)   |
| expires_at | timestamp with time zone | not null |                    | Expiration time   |
| used       | boolean                  | not null | false              | If token was used |
| created_at | timestamp                | not null | CURRENT_TIMESTAMP  | Token creation    |

Indexes:

- password_reset_tokens_pkey PRIMARY KEY (token)

Foreign-key constraints:

- user_id REFERENCES users(id) ON DELETE CASCADE

---

### email_verification_codes

| Column       | Type      | Nullable | Default           | Description                  |
| ------------ | --------- | -------- | ----------------- | ---------------------------- |
| user_id      | UUID      | not null |                   | Primary key, FK to users(id) |
| code         | text      | not null |                   | 6-digit verification code    |
| expires_at   | timestamp | not null |                   | Code expiration              |
| last_sent    | timestamp | not null |                   | Last sent timestamp          |
| created_at   | timestamp | not null | CURRENT_TIMESTAMP | Code creation                |
| resend_count | integer   | not null | 0                 | Rate limiting counter        |

Indexes:

- email_verification_codes_pkey PRIMARY KEY (user_id)

Foreign-key constraints:

- user_id REFERENCES users(id) ON DELETE CASCADE

---

## 🛠️ Discovered Gaps & TODOs (as of June 8, 2024)

### Backend

- ✅ Implement `/verify-email` and `/resend-verification` endpoints.
- ✅ On registration, generate and email a 6-digit verification code, and create an entry in `email_verification_codes`.
- ✅ Add rate limiting to `/resend-verification` and `/verify-email` endpoints.
- ✅ Replace fake session token in `/login` with JWT or real session management.
- ✅ User profile management (GET /profile, PATCH /profile with username support)
- [ ] Apply JWT middleware to all protected routes (currently only `/listings` is protected)

### Frontend

- ✅ After successful registration, navigate user to `/EmailVerification` with their user_id as a query param.
- ✅ Username field in registration form with validation
- ✅ Display seller usernames in listings
- [ ] Split login and registration into separate `/login` and `/signup` routes for clarity and better UX.

### General

- [ ] Ensure all required fields (e.g., `college`) are always available and validated in both frontend and backend.

---

## 🛣️ Immediate TODOs

### Backend

- ✅ Finalize `/verify-email` logic (code checking, expiry)
- ✅ Add rate limit + cooldown to `/resend-verification`
- ✅ User profile management with username support
- ✅ Login accepts email or username (automatic detection)
- ✅ College-specific dorm system with MIT and Harvard support
- ✅ Dorm selection in profile updates
- ✅ Dorm information in listings display
- [ ] Apply JWT middleware to all protected routes (currently only `/listings` is protected)
- [ ] Handle token expiration and logout (backend side)

### Frontend

- ✅ Navigate to EmailVerification after successful signup
- ✅ Username field in registration form
- ✅ Display seller information in listings
- ✅ Login with email or username (flexible input field)
- ✅ Removed confirm password from registration (simplified UX)
- ✅ Profile page with edit functionality and mobile-first design
- ✅ Profile icon in Home page header for easy navigation
- ✅ Enhanced Profile UI with lovable-inspired design
- ✅ Dorm selection functionality in profile
- ✅ Profile picture upload interface (UI ready)
- [ ] Show verification success message after valid entry
- [ ] Create separate `/login` and `/signup` routes

---

## 🔐 JWT Session Management Implementation (June 2024)

### Backend Implementation

**JWT Middleware (`jwtMiddleware` function in `backend/index.js`):**

- Extracts token from `Authorization: Bearer <token>` header
- Verifies token using `jwt.verify()` with `JWT_SECRET`
- Attaches decoded payload to `req.user` for route access
- Returns 401 for missing, invalid, or expired tokens

**Login Route (`/login` POST):**

- Accepts either email or username in `email_entry` field
- Detects input type by checking for '@' symbol (`email_entry.includes('@')`)
- Queries database by email OR username based on input type
- Signs JWT with user `id` and `email` payload
- Sets 1-hour expiration (`expiresIn: "1h"`)
- Returns `{ token: token, email: user.email }` on success (always returns actual email)
- Checks `is_verified` status before allowing login

**Protected Routes:**

- Currently only `/listings` GET route is protected with `jwtMiddleware`
- Other routes need middleware applied as needed

### Frontend Implementation

**Token Storage (`Login.jsx`):**

- Stores JWT in `localStorage` with key `"token"`
- Uses `res.text()` then `JSON.parse()` for robust response handling
- Navigates to `/home` after successful login

**Token Validation (`Home.jsx`):**

- Retrieves token from `localStorage` on component mount
- Uses `jwtDecode` to check token expiration
- Redirects to login if token is missing, expired, or invalid
- Sends token in `Authorization: Bearer <token>` header for API calls

**Import Issues Resolved:**

- `jwt-decode@4.0.0` uses named export: `import { jwtDecode } from "jwt-decode"`
- Not default export: `import jwtDecode from "jwt-decode"`

### Key Lessons Learned

1. **Import Syntax Matters:** Different versions of `jwt-decode` use different export patterns
2. **Token Scope:** Variables in `useEffect` need proper scoping for nested functions
3. **Error Handling:** Always check `res.ok` before calling `res.json()` to avoid parsing errors
4. **Environment Variables:** Ensure `JWT_SECRET` is set in backend `.env` file
5. **Token Expiration:** Frontend should check expiration before making API calls
6. **Debugging:** Console logs help track token flow through the authentication pipeline

### Security Considerations

- JWT tokens expire after 1 hour (configurable)
- Tokens contain minimal payload (`id`, `email`) for security
- Backend validates tokens on every protected request
- Frontend removes invalid tokens and redirects to login
- No sensitive data stored in JWT payload

---

## 👤 Username System Implementation (June 2024)

### Database Schema

**Users Table Updates:**

- Added `username VARCHAR(30) UNIQUE NOT NULL` column
- Unique constraint prevents duplicate usernames
- Username format: 3-30 characters, alphanumeric + underscores only

### Backend Implementation

**Registration Route (`/register` POST):**

- Added username validation (length, format, reserved names)
- Username uniqueness check during registration
- Specific error messages for username conflicts vs email conflicts

**Profile Routes:**

- `GET /profile`: Returns username in user profile data
- `PATCH /profile`: Allows username updates with validation
- Username uniqueness check excludes current user during updates

**Listings Route (`/listings` GET):**

- Includes seller information (first_name, last_name, username)
- JOIN with users table to display seller details

### Frontend Implementation

**Registration Form (`Register.jsx`):**

- Added username input field with helpful placeholder
- Username validation feedback from backend
- Consistent styling with other form fields
- **Simplified UX:** Removed confirm password field and validation
- Single password field for streamlined registration

**Listings Display (`Home.jsx`):**

- Shows seller information: "by John Doe (@johndoe)"
- Displays both real name and username for identification

**Login Form (`Login.jsx`):**

- Flexible input field accepts email or username
- Placeholder: "Username or Email (.edu)"
- Automatic backend detection of input type
- Simplified user experience for login

**Profile Page (`Profile.jsx`):**

- Mobile-first design with clean, intuitive interface
- Profile information display (name, username, email, college, dorm, join date, verification status)
- Enhanced UI with lovable-inspired design
- Profile picture upload interface (camera icon)
- Dorm selection dropdown with college-specific options
- Inline editing functionality for name, username, and dorm
- Profile icon in Home page header for easy navigation
- Back navigation to Home page
- Logout functionality with token cleanup
- Loading states and error handling
- Success/error message display

### Username Validation Rules

1. **Length:** 3-30 characters
2. **Format:** Letters, numbers, underscores only (regex: `/^[a-zA-Z0-9_]+$/`)
3. **Reserved Names:** Cannot use admin, moderator, support, help, info, system
4. **Uniqueness:** Must be unique across all users
5. **Case Insensitive:** Reserved name checks are case-insensitive

### Error Handling

- **409 Conflict:** Username already taken
- **400 Bad Request:** Invalid format, reserved name, or length issues
- **Specific Messages:** Different error messages for username vs email conflicts

### Future Considerations

- **Username Changes:** Currently allowed, consider cooldown period
- **Messaging System:** Ready for @username mentions and direct messaging
- **Profile URLs:** Could use usernames for public profile URLs
- **Search:** Could add username search functionality
- **Login Flexibility:** Users can login with email or username seamlessly
- **Profile Pictures:** Backend storage and retrieval needed
- **Additional Colleges:** Easy to add new colleges and dorms

---

## 🏠 College-Specific Dorm System (June 2024)

### Database Schema

**Colleges Table:**

- `id` (UUID) - Primary key
- `name` (VARCHAR) - College name (MIT, Harvard)
- `domain` (VARCHAR) - Email domain (mit.edu, harvard.edu)
- `created_at` (TIMESTAMP) - Creation time

**Dorms Table:**

- `id` (UUID) - Primary key
- `college_id` (UUID) - Foreign key to colleges
- `name` (VARCHAR) - Dorm name
- `display_order` (INTEGER) - Custom sort order (999 for Off-Campus Housing)
- `created_at` (TIMESTAMP) - Creation time
- Unique constraint on (college_id, name)

**Users Table Updates:**

- `dorm_id` (UUID) - Foreign key to dorms (optional)

### Backend Implementation

**Dorm Routes:**

- `GET /dorms/:college` - Fetch dorms for specific college
- Updated `GET /profile` - Include dorm information
- Updated `PATCH /profile` - Handle dorm updates with validation

**Validation Logic:**

- Dorm must belong to user's college
- Dorm selection is optional
- Proper error handling for invalid dorm selections

### Frontend Implementation

**Profile Page:**

- Dorm dropdown populated from college-specific API
- Dorm information displayed in profile view
- Dorm selection in edit mode

**Listings Display:**

- Dorm information shown in listing cards
- Format: "by John Doe (@johndoe) • Baker House"

### Current Colleges & Dorms

**MIT (11 dorms):**

- Baker House, Burton Conner House, East Campus, MacGregor House
- Maseeh Hall, McCormick Hall, New House, Next House
- Random Hall, Simmons Hall, Off-Campus Housing

**Harvard (13 dorms):**

- Adams House, Cabot House, Currier House, Dunster House
- Eliot House, Kirkland House, Leverett House, Lowell House
- Mather House, Pforzheimer House, Quincy House, Winthrop House
- Off-Campus Housing

### Recent Updates (June 2024)

- ✅ **Name Change:** Updated "Out of Campus Housing" to "Off-Campus Housing" for better UX
- ✅ **Display Order:** Added `display_order` column to dorms table for custom sorting
- ✅ **Bottom Placement:** Configured "Off-Campus Housing" to appear at bottom of dropdown lists
- ✅ **Alphabetical Sorting:** Regular dorms sorted alphabetically, Off-Campus Housing at bottom
- ✅ **Listing Creation Form:** Complete frontend form with image upload, form fields, and backend integration
- ✅ **Categories System:** Populated database with 6 default categories (Electronics, Furniture, Textbooks, Clothing, Appliances, Other)
- ✅ **Image Upload:** Drag & drop interface with preview grid, up to 6 images, cover image selection
- ✅ **Form Validation:** Required fields, price validation, category selection, form submission

### Scalability Features

- **Easy College Addition:** Insert new college and dorms
- **College Detection:** Auto-detect from email domain
- **Flexible Dorm Count:** Each college can have different numbers of dorms
- **Data Integrity:** Foreign key constraints prevent invalid selections

---

## 🏗️ **COMPLETED: Basic Listing Creation System**

### ✅ **What We Built (June 2024)**

#### **Frontend Components:**

- **CreateListing.jsx** - Complete listing creation page
- **Image Upload System** - Drag & drop + click to browse, up to 6 images
- **Form Fields** - Title, price, description, categories (multi-select)
- **Progressive UX** - Images first, then form fields
- **Validation** - Required fields, price validation, form submission

#### **Backend Integration:**

- **`GET /categories`** - Fetches available categories (protected with JWT)
- **`POST /listings`** - Creates new listings with images and categories
- **Database Schema** - Categories table populated with 6 default categories

#### **User Experience:**

- **Step 1:** Upload images (drag & drop or click)
- **Step 2:** Click "Proceed to Form" button
- **Step 3:** Fill out item details (title, price, description, categories)
- **Step 4:** Submit and redirect to home page

### 🎯 **Technical Features:**

- **Image Handling:** File validation, preview generation, memory cleanup
- **Form State Management:** Controlled components, validation, error handling
- **Authentication:** JWT-protected routes, user session management
- **Responsive Design:** Mobile-first, Tailwind CSS styling
- **Error Handling:** Validation errors, network errors, user feedback.

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
