# Messaging system (DB schema + notes)

This project uses PostgreSQL directly (no migration tool yet). Apply the following SQL manually via `psql`.

## Tables

### 1) conversations

Each conversation is tied to **one listing** and two users (buyer + seller).  
We keep it listing-specific so “Contact Seller” on a listing maps to exactly one thread.

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
```

### 1b) Read receipts + unread counts (migration)

We store a **per-user last read timestamp** on the conversation:

```sql
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS last_read_at_buyer TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS last_read_at_seller TIMESTAMP NULL;
```

Unread count for a user is computed as:

\[
\#\{m \in messages : m.created_at > last_read_at\_{user} \land m.sender_id \neq user\}
\]

### 2) messages

```sql
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at
  ON messages(conversation_id, created_at);
```

## Notes / next improvements

- Add `read_at` per user or a `message_reads` table for read receipts/unread counts.
- Add soft delete or user-side hide/archive.
- Add moderation/spam controls.
