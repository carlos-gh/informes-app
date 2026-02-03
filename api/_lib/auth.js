import crypto from "crypto";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 12;

const getAdminCredentials = () => ({
  username: process.env.ADMIN_USERNAME || "",
  password: process.env.ADMIN_PASSWORD || "",
});

const getTokenSecret = () => {
  return process.env.ADMIN_TOKEN_SECRET || "";
};

const safeEqual = (valueA, valueB) => {
  const bufferA = Buffer.from(valueA);
  const bufferB = Buffer.from(valueB);

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

export const validateCredentials = (username, password) => {
  const admin = getAdminCredentials();

  if (!admin.username || !admin.password) {
    return false;
  }

  return safeEqual(username, admin.username) && safeEqual(password, admin.password);
};

export const createToken = (username) => {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + TOKEN_TTL_MS;
  const payload = { username, issuedAt, expiresAt };
  const tokenBody = encodePayload(payload);
  const secret = getTokenSecret();
  const signature = signValue(tokenBody, secret);

  return {
    token: `${tokenBody}.${signature}`,
    expiresAt,
  };
};

export const verifyToken = (token) => {
  if (!token) {
    return { valid: false };
  }

  const secret = getTokenSecret();
  if (!secret) {
    return { valid: false };
  }

  const [tokenBody, signature] = token.split(".");

  if (!tokenBody || !signature) {
    return { valid: false };
  }

  const expectedSignature = signValue(tokenBody, secret);
  if (!safeEqual(signature, expectedSignature)) {
    return { valid: false };
  }

  const payload = decodePayload(tokenBody);
  if (!payload || !payload.expiresAt) {
    return { valid: false };
  }

  if (Date.now() > payload.expiresAt) {
    return { valid: false };
  }

  return { valid: true, payload };
};

export const getTokenFromRequest = (req) => {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) {
    return "";
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
