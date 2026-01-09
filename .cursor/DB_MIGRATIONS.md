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
