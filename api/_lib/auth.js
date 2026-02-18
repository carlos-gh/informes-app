import crypto from "crypto";
import { sql } from "./db.js";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;
const AUTH_COOKIE_NAME = "reports_admin_token";
const PASSWORD_HASH_PREFIX = "pbkdf2_sha256";
const PASSWORD_ITERATIONS = 310000;
const PASSWORD_KEY_LENGTH = 32;
const PASSWORD_DIGEST = "sha256";
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 128;
const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 48;
const USERNAME_PATTERN = /^[a-z0-9._-]+$/;
const FULL_NAME_MIN_LENGTH = 2;
const FULL_NAME_MAX_LENGTH = 100;

const ROLE_SUPERADMIN = "superadmin";
const ROLE_GROUP_ADMIN = "group_admin";
const AUTH_ACTIVITY_EVENT_LOGIN_SUCCESS = "login_success";
const AUTH_ACTIVITY_EVENT_LOGIN_FAILURE = "login_failure";

const getTokenSecret = () => {
  return process.env.ADMIN_TOKEN_SECRET || "";
};

const shouldUseSecureCookie = (req) => {
  if (process.env.NODE_ENV === "production") {
    return true;
  }

  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  return forwardedProto === "https";
};

const appendSetCookie = (res, cookieValue) => {
  const previous = res.getHeader("Set-Cookie");

  if (!previous) {
    res.setHeader("Set-Cookie", cookieValue);
    return;
  }

  if (Array.isArray(previous)) {
    res.setHeader("Set-Cookie", [...previous, cookieValue]);
    return;
  }

  res.setHeader("Set-Cookie", [previous, cookieValue]);
};

const buildAuthCookieValue = ({
  token = "",
  maxAgeSeconds = 0,
  secure = false,
}) => {
  const expiresAt = new Date(Date.now() + Math.max(0, maxAgeSeconds) * 1000);
  const encodedToken = encodeURIComponent(String(token || ""));
  const secureFlag = secure ? "; Secure" : "";

  return `${AUTH_COOKIE_NAME}=${encodedToken}; Path=/; HttpOnly; SameSite=Strict${secureFlag}; Max-Age=${Math.max(
    0,
    maxAgeSeconds
  )}; Expires=${expiresAt.toUTCString()}`;
};

const getCookieValue = (cookieHeader, key) => {
  if (!cookieHeader || !key) {
    return "";
  }

  const cookieParts = String(cookieHeader).split(";");

  for (const part of cookieParts) {
    const [rawName = "", ...rawValueParts] = part.split("=");
    const name = rawName.trim();

    if (name !== key) {
      continue;
    }

    const rawValue = rawValueParts.join("=");

    try {
      return decodeURIComponent(rawValue.trim());
    } catch (error) {
      return rawValue.trim();
    }
  }

  return "";
};

const normalizeUsername = (value) => {
  return String(value || "").trim().toLowerCase();
};

const normalizeLogValue = (value, maxLength) => {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  if (!Number.isInteger(maxLength) || maxLength < 1) {
    return normalized;
  }

  return normalized.slice(0, maxLength);
};

const safeEqual = (valueA, valueB) => {
  const bufferA = Buffer.from(String(valueA || ""));
  const bufferB = Buffer.from(String(valueB || ""));

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return crypto.timingSafeEqual(bufferA, bufferB);
};

const signValue = (value, secret) => {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
};

const encodePayload = (payload) => {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
};

const decodePayload = (value) => {
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf-8"));
  } catch (error) {
    return null;
  }
};

const getPasswordPepper = () => {
  return process.env.PASSWORD_PEPPER || "";
};

const derivePasswordHash = (password, salt, iterations) => {
  return crypto.pbkdf2Sync(
    `${password}${getPasswordPepper()}`,
    salt,
    iterations,
    PASSWORD_KEY_LENGTH,
    PASSWORD_DIGEST
  );
};

const parseStoredPasswordHash = (passwordHash) => {
  const parts = String(passwordHash || "").split("$");

  if (parts.length !== 4 || parts[0] !== PASSWORD_HASH_PREFIX) {
    return null;
  }

  const iterations = Number(parts[1]);
  const salt = Buffer.from(parts[2] || "", "base64url");
  const hash = Buffer.from(parts[3] || "", "base64url");

  if (
    !Number.isInteger(iterations) ||
    iterations <= 0 ||
    iterations > 1000000 ||
    salt.length === 0 ||
    hash.length !== PASSWORD_KEY_LENGTH
  ) {
    return null;
  }

  return { iterations, salt, hash };
};

export const hashPassword = (password) => {
  const salt = crypto.randomBytes(16);
  const hash = derivePasswordHash(password, salt, PASSWORD_ITERATIONS);

  return [
    PASSWORD_HASH_PREFIX,
    String(PASSWORD_ITERATIONS),
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
};

export const verifyPasswordHash = (password, passwordHash) => {
  const parsed = parseStoredPasswordHash(passwordHash);

  if (!parsed) {
    return false;
  }

  const expectedHash = derivePasswordHash(password, parsed.salt, parsed.iterations);

  if (expectedHash.length !== parsed.hash.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedHash, parsed.hash);
};

export const validateUsernameInput = (username) => {
  const normalized = normalizeUsername(username);

  if (
    normalized.length < USERNAME_MIN_LENGTH ||
    normalized.length > USERNAME_MAX_LENGTH
  ) {
    return "";
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return "";
  }

  return normalized;
};

export const validatePasswordInput = (password) => {
  const value = String(password || "");

  if (value.length < PASSWORD_MIN_LENGTH || value.length > PASSWORD_MAX_LENGTH) {
    return false;
  }

  return true;
};

export const validateFullNameInput = (fullName) => {
  const normalized = String(fullName || "")
    .replace(/\s+/g, " ")
    .trim();

  if (
    normalized.length < FULL_NAME_MIN_LENGTH ||
    normalized.length > FULL_NAME_MAX_LENGTH
  ) {
    return "";
  }

  return normalized;
};

export const ensureIdentitySchema = async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS groups (
      group_number INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      superintendent_user_id INTEGER UNIQUE,
      assistant_user_id INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      full_name TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'group_admin',
      group_number INTEGER,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS auth_activity (
      id SERIAL PRIMARY KEY,
      event_type TEXT NOT NULL,
      user_id INTEGER,
      username TEXT,
      ip_address TEXT,
      user_agent TEXT,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_number INTEGER;`;
  await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS name TEXT;`;
  await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS superintendent_user_id INTEGER;`;
  await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS assistant_user_id INTEGER;`;
  await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`;

  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'group_admin';`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS group_number INTEGER;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`;
  await sql`ALTER TABLE auth_activity ADD COLUMN IF NOT EXISTS event_type TEXT;`;
  await sql`ALTER TABLE auth_activity ADD COLUMN IF NOT EXISTS user_id INTEGER;`;
  await sql`ALTER TABLE auth_activity ADD COLUMN IF NOT EXISTS username TEXT;`;
  await sql`ALTER TABLE auth_activity ADD COLUMN IF NOT EXISTS ip_address TEXT;`;
  await sql`ALTER TABLE auth_activity ADD COLUMN IF NOT EXISTS user_agent TEXT;`;
  await sql`ALTER TABLE auth_activity ADD COLUMN IF NOT EXISTS detail TEXT;`;
  await sql`ALTER TABLE auth_activity ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`;

  await sql`ALTER TABLE users ALTER COLUMN role SET DEFAULT 'group_admin';`;
  await sql`ALTER TABLE users ALTER COLUMN is_active SET DEFAULT TRUE;`;

  await sql`UPDATE users SET username = LOWER(TRIM(username)) WHERE username IS NOT NULL;`;
  await sql`UPDATE users SET full_name = NULL WHERE full_name IS NOT NULL AND LENGTH(TRIM(full_name)) = 0;`;
  await sql`UPDATE users SET role = 'group_admin' WHERE role IS NULL OR role = '';`;
  await sql`UPDATE users SET is_active = TRUE WHERE is_active IS NULL;`;
  await sql`UPDATE groups SET updated_at = NOW() WHERE updated_at IS NULL;`;
  await sql`UPDATE users SET updated_at = NOW() WHERE updated_at IS NULL;`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS users_username_unique_idx ON users (username);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS groups_group_number_unique_idx ON groups (group_number);`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS groups_assistant_user_id_unique_idx ON groups (assistant_user_id) WHERE assistant_user_id IS NOT NULL;`;
  await sql`CREATE INDEX IF NOT EXISTS auth_activity_created_at_idx ON auth_activity (created_at DESC);`;
  await sql`CREATE INDEX IF NOT EXISTS auth_activity_user_id_idx ON auth_activity (user_id);`;
};

const bootstrapSuperAdmin = async () => {
  const envUsername = validateUsernameInput(process.env.ADMIN_USERNAME || "");
  const envPassword = String(process.env.ADMIN_PASSWORD || "");

  if (!envUsername || !envPassword) {
    return;
  }

  const result = await sql`
    SELECT id
    FROM users
    WHERE username = ${envUsername}
    LIMIT 1;
  `;

  if (0 === result.rows.length) {
    const passwordHash = hashPassword(envPassword);

    await sql`
      INSERT INTO users (
        username,
        password_hash,
        role,
        group_number,
        is_active
      )
      VALUES (
        ${envUsername},
        ${passwordHash},
        ${ROLE_SUPERADMIN},
        NULL,
        TRUE
      );
    `;
    return;
  }

  await sql`
    UPDATE users
    SET
      role = ${ROLE_SUPERADMIN},
      is_active = TRUE,
      updated_at = NOW()
    WHERE username = ${envUsername};
  `;
};

const buildAuthUser = (row) => {
  const role = String(row?.role || ROLE_GROUP_ADMIN);
  const normalizedRole = role === ROLE_SUPERADMIN ? ROLE_SUPERADMIN : ROLE_GROUP_ADMIN;
  const groupNumberValue =
    row?.groupNumber === null || row?.groupNumber === undefined
      ? null
      : Number(row.groupNumber);
  const groupNumber = Number.isNaN(groupNumberValue) ? null : groupNumberValue;

  return {
    userId: Number(row?.id || 0),
    username: String(row?.username || ""),
    fullName: String(row?.fullName || ""),
    role: normalizedRole,
    groupNumber,
    isSuperAdmin: normalizedRole === ROLE_SUPERADMIN,
  };
};

const getUserForAuthByUsername = async (username) => {
  const result = await sql`
    SELECT
      id,
      username,
      full_name AS "fullName",
      password_hash AS "passwordHash",
      role,
      group_number AS "groupNumber",
      is_active AS "isActive"
    FROM users
    WHERE username = ${username}
    LIMIT 1;
  `;

  return result.rows[0] || null;
};

const getUserForAuthById = async (userId) => {
  const result = await sql`
    SELECT
      id,
      username,
      full_name AS "fullName",
      password_hash AS "passwordHash",
      role,
      group_number AS "groupNumber",
      is_active AS "isActive"
    FROM users
    WHERE id = ${userId}
    LIMIT 1;
  `;

  return result.rows[0] || null;
};

export const authenticateUser = async (username, password) => {
  const normalizedUsername = validateUsernameInput(username);
  const passwordValue = String(password || "");

  if (!normalizedUsername || !passwordValue) {
    return null;
  }

  await ensureIdentitySchema();
  await bootstrapSuperAdmin();

  const user = await getUserForAuthByUsername(normalizedUsername);

  if (!user || true !== Boolean(user.isActive)) {
    return null;
  }

  if (!verifyPasswordHash(passwordValue, user.passwordHash)) {
    return null;
  }

  return buildAuthUser(user);
};

export const createToken = (authUser) => {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const user = authUser || {};
  const payload = {
    userId: Number(user.userId || 0),
    username: String(user.username || ""),
    fullName: String(user.fullName || ""),
    role: String(user.role || ROLE_GROUP_ADMIN),
    groupNumber:
      user.groupNumber === null || user.groupNumber === undefined
        ? null
        : Number(user.groupNumber),
    issuedAt,
    expiresAt,
  };
  const tokenBody = encodePayload(payload);
  const secret = getTokenSecret();
  const signature = signValue(tokenBody, secret);

  return {
    token: `${tokenBody}.${signature}`,
    expiresAt,
  };
};

export const setAuthTokenCookie = (req, res, token) => {
  const maxAgeSeconds = Math.floor(TOKEN_TTL_MS / 1000);
  const cookieValue = buildAuthCookieValue({
    token,
    maxAgeSeconds,
    secure: shouldUseSecureCookie(req),
  });

  appendSetCookie(res, cookieValue);
};

export const clearAuthTokenCookie = (req, res) => {
  const cookieValue = buildAuthCookieValue({
    token: "",
    maxAgeSeconds: 0,
    secure: shouldUseSecureCookie(req),
  });

  appendSetCookie(res, cookieValue);
};

export const verifyToken = (token) => {
  if (!token) {
    return { valid: false };
  }

  const secret = getTokenSecret();
  if (!secret) {
    return { valid: false };
  }

  const [tokenBody, signature] = String(token).split(".");

  if (!tokenBody || !signature) {
    return { valid: false };
  }

  const expectedSignature = signValue(tokenBody, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return { valid: false };
  }

  const payload = decodePayload(tokenBody);
  if (!payload || !payload.expiresAt || !payload.userId || !payload.username) {
    return { valid: false };
  }

  if (Date.now() > payload.expiresAt) {
    return { valid: false };
  }

  const role =
    payload.role === ROLE_SUPERADMIN ? ROLE_SUPERADMIN : ROLE_GROUP_ADMIN;
  const groupNumberValue =
    payload.groupNumber === null || payload.groupNumber === undefined
      ? null
      : Number(payload.groupNumber);
  const groupNumber = Number.isNaN(groupNumberValue) ? null : groupNumberValue;

  return {
    valid: true,
    payload: {
      userId: Number(payload.userId),
      username: String(payload.username),
      fullName: String(payload.fullName || ""),
      role,
      groupNumber,
      isSuperAdmin: role === ROLE_SUPERADMIN,
      issuedAt: Number(payload.issuedAt || 0),
      expiresAt: Number(payload.expiresAt || 0),
    },
  };
};

export const getTokenFromRequest = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return getCookieValue(req.headers.cookie || "", AUTH_COOKIE_NAME);
  }

  return header.slice("Bearer ".length).trim();
};

export const requireAuth = (req) => {
  const token = getTokenFromRequest(req);
  const result = verifyToken(token);

  if (!result.valid) {
    return null;
  }

  return result.payload;
};

export const refreshAuthFromDatabase = async (authPayload) => {
  if (!authPayload?.userId) {
    return null;
  }

  await ensureIdentitySchema();
  const user = await getUserForAuthById(authPayload.userId);

  if (!user || true !== Boolean(user.isActive)) {
    return null;
  }

  return buildAuthUser(user);
};

export const isSuperAdmin = (authPayload) => {
  return true === Boolean(authPayload?.isSuperAdmin || authPayload?.role === ROLE_SUPERADMIN);
};

export const getSafeAuthUser = (authPayload) => {
  if (!authPayload) {
    return null;
  }

  return {
    userId: Number(authPayload.userId || 0),
    username: String(authPayload.username || ""),
    fullName: String(authPayload.fullName || ""),
    role: isSuperAdmin(authPayload) ? ROLE_SUPERADMIN : ROLE_GROUP_ADMIN,
    groupNumber:
      authPayload.groupNumber === null || authPayload.groupNumber === undefined
        ? null
        : Number(authPayload.groupNumber),
    isSuperAdmin: isSuperAdmin(authPayload),
  };
};

export const logAuthActivity = async ({
  eventType,
  userId,
  username,
  ipAddress,
  userAgent,
  detail,
} = {}) => {
  const normalizedEventType =
    eventType === AUTH_ACTIVITY_EVENT_LOGIN_SUCCESS
      ? AUTH_ACTIVITY_EVENT_LOGIN_SUCCESS
      : AUTH_ACTIVITY_EVENT_LOGIN_FAILURE;
  const userIdValue = Number(userId);
  const normalizedUserId =
    Number.isInteger(userIdValue) && userIdValue > 0 ? userIdValue : null;
  const normalizedUsername = normalizeLogValue(normalizeUsername(username), 64);
  const normalizedIpAddress = normalizeLogValue(ipAddress, 64);
  const normalizedUserAgent = normalizeLogValue(userAgent, 255);
  const normalizedDetail = normalizeLogValue(detail, 120);

  await sql`
    INSERT INTO auth_activity (
      event_type,
      user_id,
      username,
      ip_address,
      user_agent,
      detail
    )
    VALUES (
      ${normalizedEventType},
      ${normalizedUserId},
      ${normalizedUsername},
      ${normalizedIpAddress},
      ${normalizedUserAgent},
      ${normalizedDetail}
    );
  `;
};

export const ROLE_NAMES = {
  superadmin: ROLE_SUPERADMIN,
  groupAdmin: ROLE_GROUP_ADMIN,
};
