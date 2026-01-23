const rateLimitMap = new Map(); // key: email, value: timestamp
const aiRateMap = new Map(); // key: userId, value: { windowStartMs, count }

function canRequestReset(email) {
  const now = Date.now();
  const lastRequestTime = rateLimitMap.get(email);

  if (!lastRequestTime || now - lastRequestTime > 5 * 60 * 1000) {
    // 5 minutes
    rateLimitMap.set(email, now);
    return true;
  }

  return false;
}

function canRequestAI(userId, { limit = 10, windowMs = 60 * 60 * 1000 } = {}) {
  // Simple in-memory rate limiting: N requests per window per user.
  // Good enough for dev; swap to Redis in production.
  const now = Date.now();
  const entry = aiRateMap.get(userId);
  if (!entry || now - entry.windowStartMs >= windowMs) {
    aiRateMap.set(userId, { windowStartMs: now, count: 1 });
    return { ok: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0 };
  }

  entry.count += 1;
  aiRateMap.set(userId, entry);
  return { ok: true, remaining: limit - entry.count };
}

module.exports = { canRequestReset, canRequestAI };
