import "dotenv/config";

const apiConfig = {
  fileserverHits: 0,
  platform: process.env.PLATFORM || "dev",
  jwtSecret: process.env.JWT_SECRET || "",
  polkaKey: process.env.POLKA_KEY || "",
};

const dbConfig = {
  url: process.env.DB_URL || "",
  migrationConfig: {
    migrationsFolder: "./src/db/migrations",
  },
};

export const config = {
  api: apiConfig,
  db: dbConfig,
};
