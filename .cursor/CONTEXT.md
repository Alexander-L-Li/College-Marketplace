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
- **AI/ML:** OpenAI VLM/CLIP (planned for image analysis & auto-generated listings)
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
- ✅ Split login & registration into `/login` and `/signup` pages
- [ ] Support “Sign in with Google” & “Sign in with Apple”
- ✅ Email verification success page

### 💬 Messaging System (Lab 18)

- ✅ Design conversations + messages table schema
- ✅ Implement inbox view (efficient querying)
- ✅ Build message thread view
- ✅ Add new message API
- ✅ Add read receipts / unread counts

### 🖼️ Listings Page (Home Feed)

- ✅ Fetch listings from DB on load (server-driven)
- [ ] Display cover image thumbnail
- ✅ Add search bar with keyword filtering (server-driven `?search=`)
- ✅ Sort dropdown (price/name/date) (server-driven `?sort=`)
- [ ] Display carousel for multiple images per listing

### 🧠 Discover Page (Future)

- [ ] Featured listings
- [ ] Trending categories
- [ ] Nearby campus deals (geo support optional)

### 🤝 Social Features (Post-MVP)

- [ ] Add friending system
- [ ] Allow comments on listings
- [ ] Likes/upvotes system

### 🤖 AI-Powered Listing Generation (Future)

- [ ] Integrate OpenAI VLM/CLIP for image analysis
- [ ] Auto-generate listing titles from uploaded images
- [ ] Auto-generate item descriptions from image analysis
- [ ] Suggest optimal pricing based on item category and condition
- [ ] Recommend relevant categories based on image content
- [ ] FastAPI microservice for ML/image processing (ml-service folder)
- [ ] User can accept/edit AI-generated suggestions before publishing

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
- [ ] OpenAI API integration for VLM/CLIP image analysis

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
- ✅ Split login and registration into separate `/login` and `/signup` routes for clarity and better UX.

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
- ✅ Create separate `/login` and `/signup` routes
- [ ] Integrate OpenAI VLM/CLIP for AI-powered listing generation (title, description, categories)

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

#### **Small Wins (UX/Polish):**

- ✅ **Removed hardcoded college** in listing creation: `CreateListing.jsx` now pulls the user’s `college` from `GET /profile` instead of using a hardcoded value.

### 🎯 **Technical Features:**

- **Image Handling:** File validation, preview generation, memory cleanup
- **Form State Management:** Controlled components, validation, error handling
- **Authentication:** JWT-protected routes, user session management
- **Responsive Design:** Mobile-first, Tailwind CSS styling
- **Error Handling:** Validation errors, network errors, user feedback

---

## 🎨 **COMPLETED: Listing Details Page UI Improvements**

### ✅ **What We Built (December 2024)**

#### **UI Enhancements:**

- **Image Size Optimization:** Listing images are now constrained on desktop devices (max-width: 28rem on large screens) while remaining full-width on mobile for better visual balance
- **Mobile Header Cleanup:** The listing title is hidden in the top header on mobile resolutions (the main title is still shown in the content area)
- **Centered Categories:** Category tags are now center-aligned under the "Categories" heading for improved visual hierarchy
- **Cleaner Listing Info:** Removed listing ID from the listing info sidebar (only shows posted date)
- **Improved Description Display:** Description text is now center-aligned with proper word-wrapping to prevent overflow on both mobile and desktop resolutions

#### **Technical Implementation:**

- **Responsive Image Container:** Added `max-w-md lg:max-w-lg` classes to constrain image size on larger screens
- **Centered Layout:** Applied `text-center` and `justify-center` classes to categories and description sections
- **Text Overflow Prevention:** Added `break-words overflow-wrap-anywhere max-w-full` classes to description for proper text wrapping
- **Simplified Info Display:** Removed listing ID field from the listing info sidebar

#### **User Experience:**

- Better visual balance on desktop devices
- Improved readability with centered text
- Cleaner sidebar information display
- Responsive design maintains mobile-first approach

---

## ✍️ **COMPLETED: Uppercase Listing Titles (Create Listing)**

### ✅ **What We Built**

- **Forced uppercase titles**: The listing title input in `CreateListing.jsx` now automatically transforms all typed characters to uppercase in real time, so titles are saved/submitted in uppercase by default.

---

## 👥 **COMPLETED: View Other User Profiles by User ID**

### ✅ **What We Built**

- Users can now **view other users’ profiles** using a URL containing their unique user ID.
- This supports the “View Profile” flow from listings (seller profiles).

### 🔌 **API**

- `GET /profile/:id` (JWT-protected): returns a **public profile** (no email) including `first_name`, `last_name`, `username`, `college`, `dorm_name`, `created_at`, `is_verified`.

### 🖥️ **Frontend**

- Added route: `/profile/:id`
- Added page: `PublicProfile.jsx` (read-only profile view)

---

## 🖼️ **IN PROGRESS: Profile Pictures (S3-backed Avatars)**

### 🎯 Goal

Allow users to upload a profile picture that is persisted in S3 and shown on:

- their own `Profile` page
- other users’ `PublicProfile` page

### Storage design

- Use the **same S3 bucket** but a separate prefix for avatars:
  - Listings: `listings/...`
  - Profile pictures: `profiles/<userId>/...`

### Backend

- `GET /s3/profile-upload-url` (JWT): returns `{ uploadURL, key }` under `profiles/<userId>/...`
- `PATCH /profile/avatar` (JWT): saves `users.profile_image_key` and returns `profile_image_url`
- `GET /profile` and `GET /profile/:id`: include `profile_image_url` when available

### DB

- Add `users.profile_image_key TEXT` (see `.cursor/DB_MIGRATIONS.md`)

### Docs

- See `.cursor/PROFILE_PICTURES_S3.md`

---

## 💬 **COMPLETED: Messaging (Contact Seller → Inbox/Thread)**

### ✅ What we built

- Listing page “**Contact Seller**” now opens a real conversation thread.
- Basic inbox + thread UI (send/receive messages).

### 🧱 DB

- Added schema doc: `.cursor/MESSAGING_DB.md`
- Tables:
  - `conversations` (listing-scoped buyer/seller thread)
  - `messages` (message rows per conversation)

### 🔌 Backend API (JWT-protected)

- `POST /conversations` — create or fetch a conversation for `{ listing_id }`
- `GET /conversations` — inbox list (with listing title + cover + other user + last message + **unread_count**)
- `GET /conversations/:id/messages` — fetch thread (**marks conversation as read** for current user; returns `other_last_read_at` for read receipts)
- `POST /conversations/:id/messages` — send message
- `GET /conversations/unread-count` — total unread across all conversations (for global badges)
- `GET /events?token=...` — **SSE realtime** stream (`message`, `read`, `unread`)

### 🖥️ Frontend

- Routes:
  - `/inbox` — inbox list
  - `/inbox/:id` — conversation thread
- Files:
  - `frontend/src/pages/Inbox.jsx`
  - `frontend/src/pages/Conversation.jsx`
  - `frontend/src/pages/ListingDetails.jsx` (wired Contact Seller)

### 🎨 UX updates

- **Navigation**: Home header now uses a **hamburger dropdown** for multiple destinations (Profile + Inbox + Logout), instead of a single profile icon.
- **Inbox organization**: Inbox is **grouped by listing**, so sellers can manage multiple buyers per listing in one place.
- **Chat UI**: Conversation thread is styled closer to **iOS/iMessage** (left/right bubbles, timestamps, iOS-like background + composer).
- **Unread + Read**: Inbox shows unread badges; thread shows a basic “Read” receipt on the last outgoing message.
- **Realtime**: Conversation updates in realtime via SSE; polling remains only as a fallback.
- **Send UX**: Optimistic send with “Sending…” state + Retry on failure.

### ⚠️ Realtime auth note (important)

SSE uses `EventSource`, which **cannot send Authorization headers**. For now we pass the JWT via query string:

- `GET /events?token=<JWT>`

This is acceptable for local/dev, but for production we should switch SSE auth to **HttpOnly cookies** (so the token never appears in URLs/logs).

---

## 🔐 **COMPLETED: Auth Hardening + Protected Routes**

### ✅ What we built

- Centralized frontend auth helpers (`frontend/src/lib/auth.js`) to enforce a clean:
  - **missing/expired token → logout → `/login`**
  - **401 response → logout → `/login`**
- Removed remaining hardcoded `http://localhost:3001` usage in pages and standardized on `VITE_API_BASE_URL`.

---

## 🏷️ **COMPLETED: My Listings (Edit / Delete / Mark Sold)**

### ✅ What we built

- New page: **My Listings** for managing your own listings.
- Owner-only actions:
  - Edit title/price/description
  - Mark sold / mark available
  - Delete listing

### 🔌 Backend

- `GET /my-listings` (JWT)
- `PATCH /listings/:id` (JWT, owner-only) — supports `title`, `price`, `description`, `categories`, `is_sold`
- `DELETE /listings/:id` (JWT, owner-only)

### 🖥️ Frontend

- Route: `/my-listings`
- Page: `frontend/src/pages/MyListings.jsx`
- Linked from the Home hamburger menu

### 🧱 DB

- Requires `listings.is_sold` (see `.cursor/DB_MIGRATIONS.md`)

---

## ✏️ **COMPLETED: Edit Listing Page (Owner-only)**

### ✅ What we built

- Owner-only **Edit Listing** flow from the listing details page.
- Prefills listing data and allows updating:
  - title / price / description
  - categories (checkboxes)
  - sold status toggle (requires `listings.is_sold`)
  - photos (upload/delete/set cover)

### 🖥️ Frontend

- Route: `/edit-listing/:id`
- Page: `frontend/src/pages/EditListing.jsx`
- `ListingDetails.jsx` “Edit Listing” button now navigates to this page for the owner.

### 🔌 Backend

- Uses existing `PATCH /listings/:id` (owner-only)
- `GET /listing/:id` now includes `is_sold`
- **Listing image management (owner-only)**:
  - `POST /listings/:id/images` — attach newly uploaded S3 image keys to a listing
  - `PATCH /listings/:listingId/images/:imageId/cover` — set cover image
  - `DELETE /listings/:listingId/images/:imageId` — delete image row + best-effort S3 delete (only when stored as S3 key)

---

## ❤️ **COMPLETED: Favorites / Saved Listings**

### ✅ What we built

- Users can **save/unsave** listings (favorites).
- Saved state appears:
  - on Home listing cards
  - on Listing Details (heart icon)
- New Saved page to browse saved listings.

### 🧱 DB

- `saved_listings` join table (see `.cursor/DB_MIGRATIONS.md`)

### 🔌 Backend (JWT-protected)

- `GET /saved-listings`
- `POST /saved-listings` with `{ listing_id }`
- `DELETE /saved-listings/:listing_id`
- `GET /listings` includes `is_saved` when the table exists
- `GET /listing/:id` includes `is_saved` when the table exists

### 🖥️ Frontend

- Route: `/saved`
- Page: `frontend/src/pages/SavedListings.jsx`
- Home hamburger menu includes “Saved”

---

## 🤖 **PLANNED: AI-Powered Listing Generation with OpenAI VLM/CLIP**

### 🎯 **Feature Overview**

Integrate OpenAI's Vision Language Model (VLM) or CLIP to analyze uploaded listing images and automatically generate:

- **Optimized listing titles** - Marketing-focused titles that help items sell better
- **Detailed item descriptions** - Comprehensive descriptions based on visual analysis
- **Category recommendations** - Suggest relevant categories based on image content
- **Condition assessment** - Analyze item condition from images (optional)

### 🏗️ **Architecture Plan**

#### **Microservice Structure:**

- **FastAPI Service** (`/ml-service` folder) - Dedicated microservice for ML/image processing
- **OpenAI Integration** - Use OpenAI API (GPT-4 Vision or CLIP) for image analysis
- **Express Backend** - Proxy requests to FastAPI service or call OpenAI directly
- **Image Processing Flow:**
  1. User uploads images in `CreateListing.jsx`
  2. Images uploaded to S3 (or temporarily stored)
  3. Frontend sends image URLs to backend
  4. Backend calls OpenAI VLM/CLIP API with image(s)
  5. AI analyzes image and returns structured data (title, description, categories)
  6. Frontend pre-fills form fields with AI suggestions
  7. User can edit/accept suggestions before submitting

#### **API Endpoints (Planned):**

**Express Backend:**

- `POST /api/analyze-listing-image` - Send image to OpenAI, return suggestions
  - Input: Image URL or base64 encoded image
  - Output: `{ title: string, description: string, suggestedCategories: string[], confidence: number }`

**FastAPI Microservice (Future):**

- `POST /ml/analyze-image` - FastAPI endpoint for image analysis
- `POST /ml/batch-analyze` - Analyze multiple images for one listing
- `GET /ml/health` - Health check for ML service

### 🔧 **Implementation Considerations**

#### **OpenAI API Options:**

1. **GPT-4 Vision (gpt-4-vision-preview)** - Best for detailed descriptions and marketing copy

   - Can generate natural language titles and descriptions
   - Understands context and can suggest selling points
   - More expensive, slower response time

2. **CLIP (OpenAI CLIP)** - Faster, cheaper for classification

   - Better for category detection
   - Less natural language generation
   - Good for initial categorization

3. **Hybrid Approach** - Use CLIP for categories, GPT-4 Vision for descriptions
   - Cost-effective balance
   - Fast category detection + quality descriptions

#### **User Experience Flow:**

1. User uploads images in listing creation form
2. After images are uploaded, show "✨ AI Analysis" button
3. User clicks button → Loading state → AI analyzes cover image (or all images)
4. Form fields auto-populate with AI suggestions
5. User can:
   - Accept all suggestions
   - Edit individual fields
   - Regenerate suggestions
   - Ignore and write manually

#### **Technical Requirements:**

- **Image Format:** Support JPEG, PNG, WebP
- **Image Size:** Handle images up to 20MB (OpenAI limit)
- **Rate Limiting:** Limit AI analysis requests per user (prevent abuse)
- **Error Handling:** Graceful fallback if OpenAI API fails
- **Caching:** Cache analysis results for same images (optional optimization)
- **Cost Management:** Track API usage, implement usage limits if needed

#### **Prompt Engineering:**

- Design prompts that generate marketplace-optimized titles
- Focus on selling points: brand, condition, features, style
- Generate descriptions that highlight value and appeal to college students
- Suggest categories that match marketplace taxonomy

### 📋 **Implementation Checklist**

- [ ] Set up OpenAI API key and environment variables
- [ ] Create FastAPI microservice structure in `/ml-service`
- [ ] Implement image analysis endpoint (Express or FastAPI)
- [ ] Design prompt templates for title and description generation
- [ ] Add "AI Analysis" button to `CreateListing.jsx`
- [ ] Implement frontend state management for AI suggestions
- [ ] Add loading states and error handling for AI requests
- [ ] Add rate limiting for AI analysis endpoint
- [ ] Test with various item types (electronics, furniture, clothing, etc.)
- [ ] Optimize API calls (batch processing, caching)
- [ ] Add user preference to enable/disable AI suggestions
- [ ] Monitor API costs and usage

### 🎨 **UI/UX Considerations**

- **Visual Feedback:** Show AI analysis progress with animated indicator
- **Suggestion Display:** Highlight AI-generated fields differently (e.g., with "✨ AI Suggestion" badge)
- **Edit Capability:** Make it easy to edit AI suggestions
- **Regenerate Option:** Allow users to request new suggestions if unsatisfied
- **Opt-out:** Allow users to disable AI features entirely

### 💰 **Cost Considerations**

- **OpenAI Pricing:** GPT-4 Vision charges per image and tokens
- **Optimization Strategies:**
  - Only analyze cover image initially (not all 6 images)
  - Cache results for similar images
  - Offer AI analysis as premium feature (optional)
  - Batch requests when possible

### 🔗 **Integration Points**

- **CreateListing.jsx:** Add AI analysis trigger after image upload
- **Backend `/listings` POST:** Optionally validate AI-suggested categories
- **S3 Integration:** Ensure images are accessible for OpenAI API
- **FastAPI Service:** Future microservice for ML features (scalability)

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
