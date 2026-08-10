import { eq } from "drizzle-orm";

import { db } from "../index.js";

import {
  chirps,
  NewChirp,
} from "../schema.js";

export async function createChirp(
  chirp: NewChirp,
) {
  const [result] = await db
    .insert(chirps)
    .values(chirp)
    .returning();

  return result;
}

export async function getAllChirps(
  authorId?: string,
) {
  if (authorId) {
    return await db
      .select()
      .from(chirps)
      .where(eq(chirps.userId, authorId));
  }

  return await db
    .select()
    .from(chirps);
}

export async function getChirp(
  chirpId: string,
) {
  const [result] = await db
    .select()
    .from(chirps)
    .where(eq(chirps.id, chirpId));

  return result;
}

export async function deleteChirp(
  chirpId: string,
) {
  await db
    .delete(chirps)
    .where(eq(chirps.id, chirpId));
}
