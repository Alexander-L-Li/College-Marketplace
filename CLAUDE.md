# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dorm Drop (Dorm Space) is a full-stack marketplace for college students to buy/sell dorm essentials. The app supports .edu email verification, real-time messaging, AI-powered listing generation, and S3 image storage. Currently supports MIT only, with plans to expand to other colleges.

## Development Commands

### Backend (Express API)
```bash
cd backend
node index.js                    # Start server on port 3001
```

### Frontend (React/Vite)
```bash
cd frontend
npm run dev                      # Start dev server (Vite)
npm run build                    # Production build
npm run lint                     # Run ESLint
```

### ML Service (FastAPI)
```bash
cd ml-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

## Architecture

### Three-Service Architecture
```
frontend (React/Vite :5173) → backend (Express :3001) → PostgreSQL
                                      ↓
                              ml-service (FastAPI :8000)
```

### Backend Structure (`backend/`)
- `index.js` - Single Express server with all routes (no router separation)
- `db/db.js` - PostgreSQL pool using `DATABASE_URL` env var
- `config/s3.js` - AWS S3 presigned URL generation for uploads/views
- `utils/rateLimiter.js` - In-memory rate limiting for password reset and AI
- `utils/sendEmail.js` - Gmail SMTP via Nodemailer

### Frontend Structure (`frontend/src/`)
- `pages/` - React page components (one per route)
- `lib/auth.js` - JWT helpers: `requireAuth()`, `authFetch()`, `logout()`
- `App.jsx` - Route definitions using react-router-dom

### ML Service Structure (`ml-service/`)
- `main.py` - FastAPI endpoints for AI description/price generation
- `price_graph.py` - LangGraph orchestration for pricing with eBay API
- `ebay.py` - eBay Browse API integration for comparable listings

## Key Patterns

### Authentication
- JWT tokens stored in localStorage, 1-hour expiration
- Backend middleware: `jwtMiddleware` extracts user from `Authorization: Bearer <token>`
- Frontend: use `authFetch(navigate, url, options)` for authenticated requests
- Login accepts email OR username (auto-detected by `@` presence)
- Email verification uses 6-digit codes with 30-second expiration

### Image Storage (S3)
- Listing images stored as S3 keys (not full URLs) under `listings/` prefix
- Profile images under `profiles/<userId>/` prefix
- Backend generates presigned URLs on-demand via `generateViewURL(key)`
- Upload flow: `GET /s3/upload-url` → PUT to presigned URL → store key in DB

### Database Schema Checks
The backend dynamically checks for optional columns/tables before querying:
- `listingsHasIsSoldColumn()` - for `is_sold` support
- `conversationsHasReadColumns()` - for read receipt support
- `hasSavedListingsTable()` - for favorites support
- `usersHasProfileImageKeyColumn()` - for avatar support

Run migrations manually via psql (see `.context/DB_MIGRATIONS.md`).

### Real-time Messaging (SSE)
- `GET /events?token=<JWT>` - Server-sent events stream
- Events: `message`, `read`, `unread`
- SSE auth uses query param (EventSource can't set headers)

## Environment Variables

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
FRONTEND_BASE_URL=http://localhost:5173
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
S3_BUCKET_NAME=...
ML_SERVICE_URL=http://localhost:8000
EMAIL_USER=...
EMAIL_PASS=...
```

### ML Service (.env)
```
AI_PROVIDER=anthropic  # or openai
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
EBAY_CLIENT_ID=...
EBAY_CLIENT_SECRET=...
```

### Frontend (.env)
```
VITE_API_BASE_URL=http://localhost:3001
```

## Database

PostgreSQL with these core tables:
- `users` - accounts with .edu email, username, college, dorm_id
- `listings` - marketplace items with title, price, description, is_sold
- `listing_images` - S3 keys with is_cover boolean
- `categories` / `listing_categories` - many-to-many categorization
- `conversations` / `messages` - buyer/seller messaging per listing
- `saved_listings` - favorites join table
- `colleges` / `dorms` - college-specific dorm lookups (MIT only currently)
- `email_verification_codes` / `password_reset_tokens` - auth tokens

## API Route Groups

Public routes (no JWT):
- `POST /register`, `/login`, `/verify`, `/resend-verification`, `/forgot-password`
- `GET /dorms/:college`

Protected routes (JWT required):
- Listings: `GET /listings`, `GET /listing/:id`, `POST /listings`, `PATCH /listings/:id`, `DELETE /listings/:id`
- User: `GET /profile`, `PATCH /profile`, `GET /profile/:id`, `PATCH /profile/avatar`
- Messaging: `/conversations`, `/conversations/:id/messages`
- Favorites: `/saved-listings`
- AI: `POST /ai/listing-description`, `POST /ai/listing-price`
- S3: `GET /s3/upload-url`, `POST /s3/upload-urls`, `GET /s3/profile-upload-url`

---

## Completed Features

### Core Features
- User registration with .edu email validation
- Email verification (6-digit codes with cooldown)
- JWT session management with 1-hour expiration
- Login with email OR username
- Password reset flow (UUID tokens, email delivery)
- User profiles with username, college, dorm selection
- Profile pictures (S3-backed avatars)

### Listings
- Create listings with up to 6 images (S3 upload)
- Cover image selection
- Category tagging (multi-select)
- Search and filter by keyword, sort by price/date/name
- Filter by categories
- View listing details with image carousel
- Edit/delete own listings (owner-only)
- Mark listings as sold/available
- Uppercase listing titles (auto-transform)

### Messaging System
- Real-time messaging via SSE
- Conversations scoped per listing (buyer/seller)
- Inbox with unread counts and last message preview
- Read receipts (basic)
- iOS/iMessage-style chat UI

### Favorites
- Save/unsave listings
- Saved listings page
- Heart icon on listing cards and details

### AI Features (via ml-service)
- Generate recommended listing description from images (Anthropic/OpenAI)
- Recommend pricing with eBay Browse API comparables (LangGraph orchestration)
- Rate limiting: 10 AI requests per hour per user

### Other
- Mobile-first responsive design (Tailwind CSS)
- View other user's public profiles
- College-specific dorm system (MIT dorms populated)

---

## Pending Tasks (TODOs)

### Authentication
- Support "Sign in with Google" & "Sign in with Apple"
- Animate Confirm Password field (only shows when typing)

### Listings
- Display carousel for multiple images on Home feed (optional)
- Auto-generate listing titles from images
- Recommend categories based on image content
- User can accept/edit AI suggestions before publishing

### Discover Page (Future)
- Featured listings
- Trending categories
- Nearby campus deals (geo support optional)

### Social Features (Post-MVP)
- Friending system
- Comments on listings
- Likes/upvotes system

### Database & Infrastructure
- Migrate from local Postgres to Supabase
- Backup DB schema and seed test data
- Create Docker Compose for local development
- Setup NGINX reverse proxy for Express + FastAPI
- Setup GitHub Actions CI/CD
- Choose host (Railway / Fly.io / Render)
- Index search/filter columns
- Optimize query joins (eager loading)
- Introduce Redis for sessions/caching

### Production Deployment
- Vercel for frontend
- Backend deployed via container host
- Move to production email (Mailgun or SES)

### Native App (Future)
- Convert web app to Swift iOS app
- Mobile app connects to same REST API
- Add iOS-style UI with native auth

### General
- Ensure all required fields (e.g., `college`) validated in both frontend and backend

---

## Future Improvements (from context docs)

### Messaging
- Soft delete or user-side hide/archive conversations
- Moderation/spam controls
- Per-message read receipts or `message_reads` table

### S3 Image Upload
- Make bucket public for reading (simpler but less secure)
- Image optimization: resize, compress before upload
- Generate thumbnails
- Show individual upload progress
- Retry failed uploads
- Clean up partial uploads on error

### Profile Pictures
- Apply S3 lifecycle rules to cleanup old avatars
- Analytics/debugging by prefix

### AI-Powered Listings
- Set up API keys and environment variables
- Test with various item types
- Optimize API calls (batch processing, caching)
- Add user preference to enable/disable AI suggestions
- Monitor API costs and usage
- Show AI analysis progress indicator
- Highlight AI-generated fields with badge
- Allow regenerate option if unsatisfied

---

## Required Manual Migrations

The project doesn't use a formal migrations tool. Apply via `psql`:

### Profile picture support
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_image_key TEXT;
```

### Sold status
```sql
ALTER TABLE listings ADD COLUMN IF NOT EXISTS is_sold BOOLEAN NOT NULL DEFAULT false;
```

### Read receipts
```sql
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_read_at_buyer TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS last_read_at_seller TIMESTAMP NULL;
```

### Favorites
```sql
CREATE TABLE IF NOT EXISTS saved_listings (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, listing_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_listings_user_id ON saved_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_listings_listing_id ON saved_listings(listing_id);
```

### Messaging tables
```sql
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (listing_id, buyer_id, seller_id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_buyer_id ON conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller_id ON conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_listing_id ON conversations(listing_id);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at);
```
