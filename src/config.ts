import "dotenv/config";

export type APIConfig = {
  fileserverHits: number;
  platform: string;
  jwtSecret: string;
};

export type DBConfig = {
  url: string;
  migrationConfig: {
    migrationsFolder: string;
  };
};

export type Config = {
  api: APIConfig;
  db: DBConfig;
};

function envOrThrow(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

export const config: Config = {
  api: {
    fileserverHits: 0,

    platform: envOrThrow("PLATFORM"),

    jwtSecret: envOrThrow("JWT_SECRET"),
  },

  db: {
    url: envOrThrow("DB_URL"),

    migrationConfig: {
      migrationsFolder: "./src/db/migrations",
    },
  },
};
