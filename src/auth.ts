import argon2 from "argon2";
import crypto from "crypto";
import jwt, { type JwtPayload } from "jsonwebtoken";
import type { Request } from "express";

export async function hashPassword(password: string): Promise<string> {
  return await argon2.hash(password);
}

export async function checkPasswordHash(
  password: string,
  hash: string,
): Promise<boolean> {
  return await argon2.verify(hash, password);
}

type ChirpyJwtPayload = Pick<
  JwtPayload,
  "iss" | "sub" | "iat" | "exp"
>;

export function makeJWT(
  userID: string,
  expiresIn: number,
  secret: string,
): string {
  const iat = Math.floor(Date.now() / 1000);

  const payload: ChirpyJwtPayload = {
    iss: "chirpy",
    sub: userID,
    iat,
    exp: iat + expiresIn,
  };

  return jwt.sign(payload, secret);
}

export function validateJWT(
  tokenString: string,
  secret: string,
): string {
  try {
    const payload = jwt.verify(tokenString, secret) as JwtPayload;

    if (!payload.sub || typeof payload.sub !== "string") {
      throw new Error("Invalid token");
    }

    return payload.sub;
  } catch {
    throw new Error("Invalid token");
  }
}

export function getBearerToken(req: Request): string {
  const authHeader = req.get("Authorization");

  if (!authHeader) {
    throw new Error("Missing Authorization header");
  }

  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new Error("Invalid Authorization header");
  }

  return token;
}

export function makeRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}
