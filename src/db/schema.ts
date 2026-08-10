import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),

  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow(),

  email: varchar("email", {
    length: 255,
  }).notNull(),

  hashedPassword: varchar(
    "hashed_password",
    {
      length: 255,
    },
  )
    .notNull()
    .default("unset"),

  isChirpyRed: boolean(
    "is_chirpy_red",
  )
    .notNull()
    .default(false),
});

export type NewUser =
  typeof users.$inferInsert;

export type User =
  typeof users.$inferSelect;

export const chirps = pgTable("chirps", {
  id: uuid("id")
    .primaryKey()
    .defaultRandom(),

  createdAt: timestamp("created_at")
    .notNull()
    .defaultNow(),

  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow(),

  body: varchar("body", {
    length: 255,
  }).notNull(),

  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, {
      onDelete: "cascade",
    }),
});

export type NewChirp =
  typeof chirps.$inferInsert;

export type Chirp =
  typeof chirps.$inferSelect;

export const refreshTokens =
  pgTable("refresh_tokens", {
    token: text("token")
      .primaryKey(),

    createdAt: timestamp("created_at")
      .notNull()
      .defaultNow(),

    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, {
        onDelete: "cascade",
      }),

    expiresAt: timestamp("expires_at")
      .notNull(),

    revokedAt: timestamp(
      "revoked_at",
    ),
  });

export type NewRefreshToken =
  typeof refreshTokens.$inferInsert;

export type RefreshToken =
  typeof refreshTokens.$inferSelect;
