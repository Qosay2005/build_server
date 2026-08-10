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
  upgradeUserToChirpyRed,
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
  getAPIKey,
} from "./auth.js";

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

const app = express();

const PORT = 8080;

// ============================================================
// Middleware
// ============================================================

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

// ============================================================
// Health
// ============================================================

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

// ============================================================
// Static Files
// ============================================================

app.use(
  "/app",
  middlewareMetricsInc,
  express.static("./src/app"),
);

// ============================================================
// Admin Metrics
// ============================================================

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

// ============================================================
// Admin Reset
// ============================================================

app.post(
  "/admin/reset",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      if (
        config.api.platform !== "dev"
      ) {
        res
          .status(403)
          .send("Forbidden");

        return;
      }

      config.api.fileserverHits = 0;

      await deleteAllRefreshTokens();

      await deleteAllUsers();

      res
        .status(200)
        .send("Reset");
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// Create User
// ============================================================

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
          error:
            "Invalid request body",
        });

        return;
      }

      const hashedPassword =
        await hashPassword(password);

      const user =
        await createUser({
          email,
          hashedPassword,
        });

      res.status(201).json({
        id: user.id,
        createdAt:
          user.createdAt,
        updatedAt:
          user.updatedAt,
        email: user.email,
        isChirpyRed:
          user.isChirpyRed,
      });
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// Login
// ============================================================

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
          error:
            "Invalid request body",
        });

        return;
      }

      const user =
        await getUserByEmail(email);

      if (!user) {
        res.status(401).json({
          error:
            "incorrect email or password",
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
          error:
            "incorrect email or password",
        });

        return;
      }

      // Access token: 1 hour
      const token = makeJWT(
        user.id,
        60 * 60,
        config.api.jwtSecret,
      );

      // Refresh token: 60 days
      const refreshToken =
        makeRefreshToken();

      const expiresAt = new Date(
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
        expiresAt,
        revokedAt: null,
      });

      res.status(200).json({
        id: user.id,
        createdAt:
          user.createdAt,
        updatedAt:
          user.updatedAt,
        email: user.email,
        isChirpyRed:
          user.isChirpyRed,
        token,
        refreshToken,
      });
    } catch (error) {
      console.log(error);

      res.status(401).json({
        error:
          "incorrect email or password",
      });
    }
  },
);

// ============================================================
// Refresh Token
// ============================================================

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
          error:
            "Invalid refresh token",
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
        error:
          "Invalid refresh token",
      });
    }
  },
);

// ============================================================
// Revoke Refresh Token
// ============================================================

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
        error:
          "Invalid refresh token",
      });
    }
  },
);

// ============================================================
// Update User
// ============================================================

app.put(
  "/api/users",
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const token =
        getBearerToken(req);

      const userID =
        validateJWT(
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
          error:
            "Invalid request body",
        });

        return;
      }

      const hashedPassword =
        await hashPassword(
          password,
        );

      const updatedUser =
        await updateUser(
          userID,
          email,
          hashedPassword,
        );

      if (!updatedUser) {
        res.status(404).json({
          error:
            "User not found",
        });

        return;
      }

      res.status(200).json({
        id: updatedUser.id,
        createdAt:
          updatedUser.createdAt,
        updatedAt:
          updatedUser.updatedAt,
        email:
          updatedUser.email,
        isChirpyRed:
          updatedUser.isChirpyRed,
      });
    } catch (error) {
      res.status(401).json({
        error:
          "Invalid token",
      });
    }
  },
);

// ============================================================
// Create Chirp
// ============================================================

app.post(
  "/api/chirps",
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const token =
        getBearerToken(req);

      const userID =
        validateJWT(
          token,
          config.api.jwtSecret,
        );

      const { body } =
        req.body;

      if (
        typeof body !== "string"
      ) {
        res.status(400).json({
          error:
            "Invalid request body",
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

      const words =
        body.split(" ");

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

      const chirp =
        await createChirp({
          body: cleanedBody,
          userId: userID,
        });

      res.status(201).json({
        id: chirp.id,
        createdAt:
          chirp.createdAt,
        updatedAt:
          chirp.updatedAt,
        body: chirp.body,
        userId:
          chirp.userId,
      });
    } catch (error) {
      res.status(401).json({
        error:
          "Invalid token",
      });
    }
  },
);

// ============================================================
// Get All Chirps
// ============================================================

app.get(
  "/api/chirps",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      // Optional authorId filter
      let authorId = "";

      const authorIdQuery =
        req.query.authorId;

      if (
        typeof authorIdQuery ===
        "string"
      ) {
        authorId = authorIdQuery;
      }

      const chirps =
        await getAllChirps(
          authorId,
        );

      // Optional sorting
      // Default: ascending
      let sort = "asc";

      const sortQuery =
        req.query.sort;

      if (
        typeof sortQuery ===
        "string"
      ) {
        sort = sortQuery;
      }

      chirps.sort((a, b) => {
        const dateA =
          new Date(
            a.createdAt,
          ).getTime();

        const dateB =
          new Date(
            b.createdAt,
          ).getTime();

        if (sort === "desc") {
          return dateB - dateA;
        }

        return dateA - dateB;
      });

      res
        .status(200)
        .json(chirps);
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// Get Chirp
// ============================================================

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
          error:
            "Invalid chirp ID",
        });

        return;
      }

      const chirp =
        await getChirp(chirpId);

      if (!chirp) {
        res.status(404).json({
          error:
            "Chirp not found",
        });

        return;
      }

      res
        .status(200)
        .json(chirp);
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// Delete Chirp
// ============================================================

app.delete(
  "/api/chirps/:chirpId",
  async (
    req: Request,
    res: Response,
  ) => {
    try {
      const token =
        getBearerToken(req);

      const userID =
        validateJWT(
          token,
          config.api.jwtSecret,
        );

      const chirpId =
        req.params.chirpId;

      if (
        typeof chirpId !== "string"
      ) {
        res.status(404).json({
          error:
            "Chirp not found",
        });

        return;
      }

      const chirp =
        await getChirp(chirpId);

      if (!chirp) {
        res.status(404).json({
          error:
            "Chirp not found",
        });

        return;
      }

      if (
        chirp.userId !== userID
      ) {
        res.status(403).json({
          error:
            "You are not authorized to delete this chirp",
        });

        return;
      }

      await deleteChirp(
        chirpId,
      );

      res.status(204).send();
    } catch (error) {
      res.status(401).json({
        error:
          "Invalid token",
      });
    }
  },
);

// ============================================================
// Polka Webhook
// ============================================================

app.post(
  "/api/polka/webhooks",
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const apiKey =
        getAPIKey(req);

      if (
        apiKey !==
        config.api.polkaKey
      ) {
        res.status(401).json({
          error:
            "Unauthorized",
        });

        return;
      }

      const {
        event,
        data,
      } = req.body;

      // Ignore events we don't care about
      if (
        event !==
        "user.upgraded"
      ) {
        res.status(204).send();

        return;
      }

      if (
        !data ||
        typeof data.userId !==
          "string"
      ) {
        res.status(400).json({
          error:
            "Invalid request body",
        });

        return;
      }

      const user =
        await upgradeUserToChirpyRed(
          data.userId,
        );

      if (!user) {
        res.status(404).json({
          error:
            "User not found",
        });

        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);

// ============================================================
// Error Handler
// ============================================================

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  console.log(err);

  res.status(500).json({
    error:
      "Something went wrong on our end",
  });
}

app.use(errorHandler);

// ============================================================
// Start Server
// ============================================================

app.listen(
  PORT,
  () => {
    console.log(
      `Server is running at http://localhost:${PORT}`,
    );
  },
);
