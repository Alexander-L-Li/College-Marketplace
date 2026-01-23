# Database migrations (manual)

This repo currently doesn’t have a formal migrations tool wired up (like Prisma/Knex). For now, we apply small schema changes manually via `psql`.

## Migration: add profile picture support

### Goal

Store an S3 key per user under `profiles/<userId>/...` so we can generate a presigned `profile_image_url` for display.

### SQL

Run this in the `college_marketplace` database:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_image_key TEXT;
```

### Notes

- We store the **S3 key** (example: `profiles/1b2c.../1700000000000-avatar.jpg`) in `users.profile_image_key`.
- We do **not** store a full URL; the backend generates a presigned view URL on demand.

---

## Migration: add sold status to listings

### Goal

Allow users to mark their own listings as sold (and optionally re-list).

### SQL

```sql
ALTER TABLE listings
ADD COLUMN IF NOT EXISTS is_sold BOOLEAN NOT NULL DEFAULT false;
```

---

## Migration: messaging unread counts + read receipts

### Goal

Support:

- **Unread counts** per conversation (and aggregations like per listing)
- **Read receipts** (basic: “other user has read up to time X”)

### SQL

```sql
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_read_at_buyer TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS last_read_at_seller TIMESTAMP NULL;
```

---

## Migration: favorites / saved listings

### Goal

Allow users to “save” listings (favorites) and view them later.

### SQL

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
