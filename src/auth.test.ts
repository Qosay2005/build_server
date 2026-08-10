import { describe, it, expect, beforeAll } from "vitest";

import {
  hashPassword,
  checkPasswordHash,
  makeJWT,
  validateJWT,
} from "./auth.js";

describe("Password Hashing", () => {
  const password1 = "correctPassword123!";
  const password2 = "anotherPassword456!";

  let hash1: string;
  let hash2: string;

  beforeAll(async () => {
    hash1 = await hashPassword(password1);
    hash2 = await hashPassword(password2);
  });

  it("should return true for the correct password", async () => {
    const result = await checkPasswordHash(password1, hash1);

    expect(result).toBe(true);
  });

  it("should return false for the wrong password", async () => {
    const result = await checkPasswordHash(password2, hash1);

    expect(result).toBe(false);
  });

  it("should return true for the second correct password", async () => {
    const result = await checkPasswordHash(password2, hash2);

    expect(result).toBe(true);
  });

  it("should not generate the same hash twice", async () => {
    expect(hash1).not.toBe(hash2);
  });
});

describe("JWT", () => {
  const userID = "123e4567-e89b-12d3-a456-426614174000";
  const secret = "super-secret";

  it("should create and validate a JWT", () => {
    const token = makeJWT(userID, 60, secret);

    const result = validateJWT(token, secret);

    expect(result).toBe(userID);
  });

  it("should reject a JWT signed with the wrong secret", () => {
    const token = makeJWT(userID, 60, secret);

    expect(() => {
      validateJWT(token, "wrong-secret");
    }).toThrow();
  });

  it("should reject an expired JWT", () => {
    const token = makeJWT(userID, -1, secret);

    expect(() => {
      validateJWT(token, secret);
    }).toThrow();
  });
});
