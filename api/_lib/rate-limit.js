const RATE_LIMIT_STORE = new Map();
const MAX_RATE_LIMIT_KEYS = 10000;

const cleanupRateLimitStore = (nowMs) => {
  if (RATE_LIMIT_STORE.size < MAX_RATE_LIMIT_KEYS) {
    return;
  }

  for (const [key, entry] of RATE_LIMIT_STORE.entries()) {
    if (!entry) {
      RATE_LIMIT_STORE.delete(key);
      continue;
    }

    if (entry.blockedUntilMs <= nowMs && entry.windowStartMs + entry.windowMs <= nowMs) {
      RATE_LIMIT_STORE.delete(key);
    }
  }
};

export const consumeRateLimit = ({
  key,
  limit,
  windowMs,
  blockMs = 0,
}) => {
  const normalizedKey = String(key || "").trim();
  const normalizedLimit = Number(limit);
  const normalizedWindowMs = Number(windowMs);
  const normalizedBlockMs = Math.max(0, Number(blockMs) || 0);
  const nowMs = Date.now();

  if (
    !normalizedKey ||
    !Number.isInteger(normalizedLimit) ||
    normalizedLimit < 1 ||
    !Number.isInteger(normalizedWindowMs) ||
    normalizedWindowMs < 1000
  ) {
    return {
      allowed: true,
      remaining: normalizedLimit > 0 ? normalizedLimit : 1,
      retryAfterMs: 0,
    };
  }

  cleanupRateLimitStore(nowMs);

  const currentEntry = RATE_LIMIT_STORE.get(normalizedKey);

  if (currentEntry && currentEntry.blockedUntilMs > nowMs) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: currentEntry.blockedUntilMs - nowMs,
    };
  }

  if (
    !currentEntry ||
    currentEntry.windowStartMs + currentEntry.windowMs <= nowMs
  ) {
    RATE_LIMIT_STORE.set(normalizedKey, {
      count: 1,
      windowStartMs: nowMs,
      windowMs: normalizedWindowMs,
      blockedUntilMs: 0,
    });

    return {
      allowed: true,
      remaining: Math.max(0, normalizedLimit - 1),
      retryAfterMs: 0,
    };
  }

  const nextCount = currentEntry.count + 1;

  if (nextCount > normalizedLimit) {
    const retryAfterMs = normalizedBlockMs || currentEntry.windowStartMs + currentEntry.windowMs - nowMs;
    const blockedUntilMs = nowMs + retryAfterMs;

    RATE_LIMIT_STORE.set(normalizedKey, {
      ...currentEntry,
      count: nextCount,
      blockedUntilMs,
    });

    return {
      allowed: false,
      remaining: 0,
      retryAfterMs,
    };
  }

  RATE_LIMIT_STORE.set(normalizedKey, {
    ...currentEntry,
    count: nextCount,
  });

  return {
    allowed: true,
    remaining: Math.max(0, normalizedLimit - nextCount),
    retryAfterMs: 0,
  };
};
