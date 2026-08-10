import { eq, and, gt, isNull } from "drizzle-orm";

import { db } from "../index.js";

import {
  refreshTokens,
  users,
  NewRefreshToken,
} from "../schema.js";

export async function createRefreshToken(
  token: NewRefreshToken,
) {
  const [result] = await db
    .insert(refreshTokens)
    .values(token)
    .returning();

  return result;
}

export async function getUserFromRefreshToken(
  token: string,
) {
  const result = await db
    .select()
    .from(refreshTokens)
    .innerJoin(
      users,
      eq(refreshTokens.userId, users.id),
    )
    .where(
      and(
        eq(refreshTokens.token, token),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    );

  return result[0];
}

export async function revokeRefreshToken(
  token: string,
) {
  await db
    .update(refreshTokens)
    .set({
      revokedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(refreshTokens.token, token));
}

export async function deleteAllRefreshTokens() {
  await db.delete(refreshTokens);
}
