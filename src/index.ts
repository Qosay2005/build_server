import express, {
  Request,
  Response,
  NextFunction,
} from "express";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { config } from "./config.js";

import {
  createUser,
  deleteAllUsers,
  getUserByEmail,
  updateUser,
} from "./db/queries/users.js";

import {
  createRefreshToken,
  getUserFromRefreshToken,
  revokeRefreshToken,
  deleteAllRefreshTokens,
} from "./db/queries/refreshTokens.js";

import {
  createChirp,
  getAllChirps,
  getChirp,
  deleteChirp,
} from "./db/queries/chirps.js";

import {
  hashPassword,
  checkPasswordHash,
  makeJWT,
  makeRefreshToken,
  getBearerToken,
  validateJWT,
} from "./auth.js";

// ============================================
// Database migrations
// ============================================

const migrationClient = postgres(
  config.db.url,
  {
    max: 1,
  },
);

await migrate(
  drizzle(migrationClient),
  config.db.migrationConfig,
);

await migrationClient.end();

// ============================================
// App
// ============================================

const app = express();

const PORT = 8080;

// ============================================
// Middleware
// ============================================

function middlewareLogResponses(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      console.log(
        `[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`,
      );
    }
  });

  next();
}

function middlewareMetricsInc(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  config.api.fileserverHits++;

  next();
}

app.use(middlewareLogResponses);

app.use(express.json());

// ============================================
// Health check
// ============================================

app.get(
  "/api/healthz",
  (req: Request, res: Response) => {
    res
      .set(
        "Content-Type",
        "text/plain; charset=utf-8",
      )
      .send("OK");
  },
);

// ============================================
// Static files
// ============================================

app.use(
  "/app",
  middlewareMetricsInc,
  express.static("./src/app"),
);

// ============================================
// Admin metrics
// ============================================

app.get(
  "/admin/metrics",
  (req: Request, res: Response) => {
    res
      .set(
        "Content-Type",
        "text/html; charset=utf-8",
      )
      .send(
        `<html>
          <body>
            <h1>Welcome, Chirpy Admin</h1>
            <p>
              Chirpy has been visited
              ${config.api.fileserverHits}
              times!
            </p>
          </body>
        </html>`,
      );
  },
);

// ============================================
// Admin reset
// ============================================

app.post(
  "/admin/reset",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (config.api.platform !== "dev") {
        res.status(403).send("Forbidden");
        return;
      }

      config.api.fileserverHits = 0;

      await deleteAllUsers();

      await deleteAllRefreshTokens();

      res.status(200).send("Reset");
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// Create User
// ============================================

app.post(
  "/api/users",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (
        typeof email !== "string" ||
        typeof password !== "string"
      ) {
        res.status(400).json({
          error: "Invalid request body",
        });

        return;
      }

      const hashedPassword =
        await hashPassword(password);

      const user = await createUser({
        email,
        hashedPassword,
      });

      res.status(201).json({
        id: user.id,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        email: user.email,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// Login
// ============================================

app.post(
  "/api/login",
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const {
        email,
        password,
      } = req.body;

      if (
        typeof email !== "string" ||
        typeof password !== "string"
      ) {
        res.status(400).json({
          error: "Invalid request body",
        });

        return;
      }

      const user =
        await getUserByEmail(email);

      if (!user) {
        res.status(401).json({
          error: "incorrect email or password",
        });

        return;
      }

      const passwordCorrect =
        await checkPasswordHash(
          password,
          user.hashedPassword,
        );

      if (!passwordCorrect) {
        res.status(401).json({
          error: "incorrect email or password",
        });

        return;
      }

      // Access token expires after 1 hour
      const token = makeJWT(
        user.id,
        60 * 60,
        config.api.jwtSecret,
      );

      // Refresh token expires after 60 days
      const refreshToken =
        makeRefreshToken();

      const refreshTokenExpiresAt =
        new Date(
          Date.now() +
            60 *
              24 *
              60 *
              60 *
              1000,
        );

      await createRefreshToken({
        token: refreshToken,
        userId: user.id,
        expiresAt:
          refreshTokenExpiresAt,
        revokedAt: null,
      });

      res.status(200).json({
        id: user.id,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        email: user.email,
        token,
        refreshToken,
      });
    } catch (error) {
      console.log(error);

      res.status(401).json({
        error: "incorrect email or password",
      });
    }
  },
);

// ============================================
// Update User
// ============================================

app.put(
  "/api/users",
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const token = getBearerToken(req);

      const userId = validateJWT(
        token,
        config.api.jwtSecret,
      );

      const {
        email,
        password,
      } = req.body;

      if (
        typeof email !== "string" ||
        typeof password !== "string"
      ) {
        res.status(400).json({
          error: "Invalid request body",
        });

        return;
      }

      const hashedPassword =
        await hashPassword(password);

      const updatedUser =
        await updateUser(
          userId,
          email,
          hashedPassword,
        );

      if (!updatedUser) {
        res.status(404).json({
          error: "User not found",
        });

        return;
      }

      res.status(200).json({
        id: updatedUser.id,
        createdAt:
          updatedUser.createdAt,
        updatedAt:
          updatedUser.updatedAt,
        email: updatedUser.email,
      });
    } catch (error) {
      res.status(401).json({
        error: "Invalid token",
      });
    }
  },
);

// ============================================
// Refresh Token
// ============================================

app.post(
  "/api/refresh",
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const refreshToken =
        getBearerToken(req);

      const result =
        await getUserFromRefreshToken(
          refreshToken,
        );

      if (!result) {
        res.status(401).json({
          error: "Invalid refresh token",
        });

        return;
      }

      const user = result.users;

      const token = makeJWT(
        user.id,
        60 * 60,
        config.api.jwtSecret,
      );

      res.status(200).json({
        token,
      });
    } catch (error) {
      res.status(401).json({
        error: "Invalid refresh token",
      });
    }
  },
);

// ============================================
// Revoke Refresh Token
// ============================================

app.post(
  "/api/revoke",
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const refreshToken =
        getBearerToken(req);

      await revokeRefreshToken(
        refreshToken,
      );

      res.status(204).send();
    } catch (error) {
      res.status(401).json({
        error: "Invalid refresh token",
      });
    }
  },
);

// ============================================
// Create Chirp
// ============================================

app.post(
  "/api/chirps",
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const token = getBearerToken(req);

      const userId = validateJWT(
        token,
        config.api.jwtSecret,
      );

      const { body } = req.body;

      if (typeof body !== "string") {
        res.status(400).json({
          error: "Invalid request body",
        });

        return;
      }

      if (body.length > 140) {
        res.status(400).json({
          error:
            "Chirp is too long. Max length is 140",
        });

        return;
      }

      const profaneWords = [
        "kerfuffle",
        "sharbert",
        "fornax",
      ];

      const words = body.split(" ");

      const cleanedWords =
        words.map((word) => {
          if (
            profaneWords.includes(
              word.toLowerCase(),
            )
          ) {
            return "****";
          }

          return word;
        });

      const cleanedBody =
        cleanedWords.join(" ");

      const chirp = await createChirp({
        body: cleanedBody,
        userId,
      });

      res.status(201).json({
        id: chirp.id,
        createdAt: chirp.createdAt,
        updatedAt: chirp.updatedAt,
        body: chirp.body,
        userId: chirp.userId,
      });
    } catch (error) {
      res.status(401).json({
        error: "Invalid token",
      });
    }
  },
);

// ============================================
// Get All Chirps
// ============================================

app.get(
  "/api/chirps",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const chirps =
        await getAllChirps();

      res.status(200).json(chirps);
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// Get One Chirp
// ============================================

app.get(
  "/api/chirps/:chirpId",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const chirpId =
        req.params.chirpId;

      if (
        typeof chirpId !== "string"
      ) {
        res.status(400).json({
          error: "Invalid chirp ID",
        });

        return;
      }

      const chirp =
        await getChirp(chirpId);

      if (!chirp) {
        res.status(404).json({
          error: "Chirp not found",
        });

        return;
      }

      res.status(200).json(chirp);
    } catch (error) {
      next(error);
    }
  },
);

// ============================================
// Delete Chirp
// ============================================

app.delete(
  "/api/chirps/:chirpId",
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      // Get access token
      const token = getBearerToken(req);

      // Validate access token
      const userId = validateJWT(
        token,
        config.api.jwtSecret,
      );

      const chirpId =
        req.params.chirpId;

      if (
        typeof chirpId !== "string"
      ) {
        res.status(404).json({
          error: "Chirp not found",
        });

        return;
      }

      // Find the chirp
      const chirp =
        await getChirp(chirpId);

      // Chirp doesn't exist
      if (!chirp) {
        res.status(404).json({
          error: "Chirp not found",
        });

        return;
      }

      // Only the author can delete
      if (chirp.userId !== userId) {
        res.status(403).json({
          error: "Forbidden",
        });

        return;
      }

      // Delete chirp
      await deleteChirp(chirpId);

      // No response body for 204
      res.status(204).send();
    } catch (error) {
      // Missing or invalid token
      res.status(401).json({
        error: "Invalid token",
      });
    }
  },
);

// ============================================
// Error Handler
// ============================================

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log(err);

  res.status(500).json({
    error: "Something went wrong on our end",
  });
}

app.use(errorHandler);

// ============================================
// Start Server
// ============================================

app.listen(
  PORT,
  () => {
    console.log(
      `Server is running at http://localhost:${PORT}`,
    );
  },
);
