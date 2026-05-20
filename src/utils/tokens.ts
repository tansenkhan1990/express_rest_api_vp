import jwt from "jsonwebtoken";
import RefreshToken from "../models/RefreshToken";

interface TokenPayload {
  userId: string;
}

// Module-level secrets — set by initTokens() after dotenv.config() has loaded .env
let ACCESS_TOKEN_SECRET: string;
let REFRESH_TOKEN_SECRET: string;

/**
 * Initialize token secrets from environment variables.
 * Must be called after dotenv.config() has loaded the .env file.
 */
export const initTokens = (): void => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET;

  if (!accessSecret) {
    throw new Error("Missing required environment variable: ACCESS_TOKEN_SECRET");
  }
  if (!refreshSecret) {
    throw new Error("Missing required environment variable: REFRESH_TOKEN_SECRET");
  }

  ACCESS_TOKEN_SECRET = accessSecret;
  REFRESH_TOKEN_SECRET = refreshSecret;
};

// Generate a short-lived access token
export const generateAccessToken = (userId: string): string => {
  const expiresIn = process.env.ACCESS_TOKEN_EXPIRY || "15m";

  return jwt.sign({ userId }, ACCESS_TOKEN_SECRET, {
    expiresIn,
  } as jwt.SignOptions);
};

// Generate a long-lived refresh token, also persist it in the database
export const generateRefreshToken = async (userId: string): Promise<string> => {
  const expiresIn = process.env.REFRESH_TOKEN_EXPIRY || "7d";

  const token = jwt.sign({ userId }, REFRESH_TOKEN_SECRET, {
    expiresIn,
  } as jwt.SignOptions);

  // Calculate exact expiration date for DB TTL
  const decoded = jwt.decode(token) as { exp: number } | null;
  if (!decoded || !decoded.exp) {
    throw new Error("Failed to decode refresh token");
  }
  const expiresAt = new Date(decoded.exp * 1000);

  // Store refresh token in DB for invalidation support
  await RefreshToken.create({ userId, token, expiresAt });

  return token;
};

// Verify access token and return the payload
export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as TokenPayload;
};

// Verify refresh token (checks JWT signature AND DB record)
export const verifyRefreshToken = async (
  token: string
): Promise<TokenPayload | null> => {
  try {
    const payload = jwt.verify(token, REFRESH_TOKEN_SECRET) as TokenPayload;

    // Also check that the token exists in the DB (hasn't been revoked)
    const stored = await RefreshToken.findOne({ token });
    if (!stored) return null;

    return payload;
  } catch {
    return null;
  }
};

// Remove refresh token from DB (used during logout or refresh rotation)
export const revokeRefreshToken = async (token: string): Promise<void> => {
  await RefreshToken.deleteOne({ token });
};
