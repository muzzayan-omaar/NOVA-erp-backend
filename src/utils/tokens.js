import jwt from "jsonwebtoken";
import crypto from "crypto";

// Short-lived — this is what travels with every API request, stored in
// sessionStorage. A stolen access token now only has a 15-minute blast
// radius, instead of living as long as JWT_EXPIRES_IN (7 days) used to.
export const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_DAYS = 30;

export const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, companyId: user.companyId, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
};

// Refresh tokens are opaque random strings, never JWTs. The raw value
// goes to the browser only as an HttpOnly cookie — JavaScript can never
// read it, so XSS can't steal it the way it could an access token sitting
// in storage. Only its SHA-256 hash is kept server-side, so a database
// leak alone doesn't hand out anything usable either.
export const generateRefreshToken = () => {
  const raw = crypto.randomBytes(64).toString("hex");
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
  return { raw, hash, expiresAt };
};

export const hashRefreshToken = (raw) =>
  crypto.createHash("sha256").update(raw).digest("hex");

export const REFRESH_COOKIE_NAME = "nova_refresh";
export const REFRESH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth", // only ever transmitted to auth endpoints, never every request
  maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000,
};