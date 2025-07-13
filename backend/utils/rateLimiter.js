const rateLimitMap = new Map(); // key: email, value: timestamp

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

module.exports = { canRequestReset };
