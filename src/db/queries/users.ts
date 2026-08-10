import { eq } from "drizzle-orm";

import { db } from "../index.js";

import {
  NewUser,
  users,
} from "../schema.js";

export async function createUser(
  user: NewUser,
) {
  const [result] = await db
    .insert(users)
    .values(user)
    .onConflictDoNothing()
    .returning();

  return result;
}

export async function deleteAllUsers() {
  await db.delete(users);
}

export async function getUserByEmail(
  email: string,
) {
  const [result] = await db
    .select()
    .from(users)
    .where(eq(users.email, email));

  return result;
}

export async function updateUser(
  userId: string,
  email: string,
  hashedPassword: string,
) {
  const [result] = await db
    .update(users)
    .set({
      email,
      hashedPassword,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return result;
}
