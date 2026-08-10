import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { randomBytes } from "crypto";

export async function hashPassword(
  password: string,
) {
  const hash = await bcrypt.hash(password, 10);

  return hash;
}

export async function checkPasswordHash(
  password: string,
  hash: string,
) {
  return await bcrypt.compare(password, hash);
}

export function makeJWT(
  userID: string,
  expiresIn: number,
  secret: string,
) {
  return jwt.sign(
    {
      iss: "chirpy",
      sub: userID,
    },
    secret,
    {
      expiresIn,
    },
  );
}

export function validateJWT(
  tokenString: string,
  secret: string,
) {
  const decoded = jwt.verify(
    tokenString,
    secret,
  );

  if (
    typeof decoded !== "object" ||
    decoded === null ||
    typeof decoded.sub !== "string"
  ) {
    throw new Error("Invalid token");
  }

  return decoded.sub;
}

export function getBearerToken(
  req: {
    get: (name: string) => string | undefined;
  },
) {
  const authHeader =
    req.get("Authorization");

  if (!authHeader) {
    throw new Error(
      "Missing Authorization header",
    );
  }

  const parts = authHeader.split(" ");

  if (
    parts.length !== 2 ||
    parts[0] !== "Bearer"
  ) {
    throw new Error(
      "Invalid Authorization header",
    );
  }

  return parts[1];
}

export function getAPIKey(
  req: {
    get: (name: string) => string | undefined;
  },
) {
  const authHeader =
    req.get("Authorization");

  if (!authHeader) {
    return "";
  }

  const parts = authHeader.split(" ");

  if (
    parts.length !== 2 ||
    parts[0] !== "ApiKey"
  ) {
    return "";
  }

  return parts[1];
}

export function makeRefreshToken() {
  return randomBytes(32).toString("hex");
}
