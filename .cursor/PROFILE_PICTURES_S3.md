# Profile pictures + S3 (separate from listing images)

## Storage layout (recommended)

We keep profile pictures in the **same bucket** but in a **different prefix** so they’re logically separated from listing images:

- Listings: `listings/<timestamp>-<filename>`
- Profile pictures: `profiles/<userId>/<timestamp>-<filename>`

This makes it easy to:

- apply lifecycle rules later (e.g., cleanup old avatars)
- run analytics / debugging by prefix
- keep permissions and organization clean

## Backend endpoints

### 1) Get a presigned upload URL for an avatar

- `GET /s3/profile-upload-url?filename=...&contentType=...`
- Auth: JWT required
- Response:
  - `uploadURL`: presigned S3 PUT URL
  - `key`: S3 key under `profiles/<userId>/...`

### 2) Persist the avatar key to the user record

- `PATCH /profile/avatar`
- Body: `{ "profile_image_key": "profiles/<userId>/..." }`
- Auth: JWT required
- Response: `{ profile_image_key, profile_image_url }`

### 3) Fetch profile image URLs

Both endpoints return `profile_image_url` (presigned GET URL) if an avatar key exists:

- `GET /profile` (current user)
- `GET /profile/:id` (public profile by UUID; does not return email)

## Required DB change

Add the column:

```sql
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_image_key TEXT;
```

See `.cursor/DB_MIGRATIONS.md`.

## Frontend flow (Profile page)

1. User chooses an image file.
2. Frontend calls `GET /s3/profile-upload-url`.
3. Frontend uploads to S3 via `PUT uploadURL`.
4. Frontend calls `PATCH /profile/avatar` with the returned `key`.
5. Backend responds with `profile_image_url` → UI displays it.

## S3 CORS

If your browser blocks the `PUT` upload to S3, set bucket CORS to allow your dev origin:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedOrigins": ["http://localhost:5173"],
    "ExposeHeaders": ["ETag"]
  }
]
```
