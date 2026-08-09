import express, {
  NextFunction,
  Request,
  Response,
} from "express";

import { config } from "./config.js";

const app = express();
const PORT = 8080;

// Parse JSON request bodies
app.use(express.json());

// =========================
// Custom Error Classes
// =========================

class BadRequestError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.statusCode = 400;
  }
}

class UnauthorizedError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.statusCode = 401;
  }
}

class ForbiddenError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.statusCode = 403;
  }
}

class NotFoundError extends Error {
  statusCode: number;

  constructor(message: string) {
    super(message);
    this.statusCode = 404;
  }
}

// =========================
// Middleware: Log Responses
// =========================

const middlewareLogResponses = (
  req: Request,
  res: any,
  next: NextFunction
) => {
  res.on("finish", () => {
    if (res.statusCode !== 200) {
      console.log(
        `[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`
      );
    }
  });

  next();
};

// =========================
// Middleware: Count App Hits
// =========================

const middlewareMetricsInc = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  config.fileserverHits++;
  next();
};

// =========================
// Health Check
// =========================

const handlerReadiness = (
  req: Request,
  res: Response
) => {
  res.set(
    "Content-Type",
    "text/plain; charset=utf-8"
  );

  res.send("OK");
};

// =========================
// Admin Metrics
// =========================

const handlerMetrics = (
  req: Request,
  res: Response
) => {
  res.set(
    "Content-Type",
    "text/html; charset=utf-8"
  );

  res.send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.fileserverHits} times!</p>
      </body>
    </html>
  `);
};

// =========================
// Admin Reset
// =========================

const handlerReset = (
  req: Request,
  res: Response
) => {
  config.fileserverHits = 0;

  res.set(
    "Content-Type",
    "text/plain; charset=utf-8"
  );

  res.send("Reset");
};

// =========================
// Validate Chirp
// =========================

const handlerValidateChirp = async (
  req: Request,
  res: Response
) => {
  const body = req.body.body;

  // Make sure body exists and is a string
  if (typeof body !== "string") {
    throw new BadRequestError("Invalid request body");
  }

  // Chirp is too long
  if (body.length > 140) {
    throw new BadRequestError(
      "Chirp is too long. Max length is 140"
    );
  }

  // Words that are not allowed
  const profaneWords = [
    "kerfuffle",
    "sharbert",
    "fornax",
  ];

  // Split the chirp into words
  const words = body.split(" ");

  // Replace profane words
  const cleanedWords = words.map((word) => {
    if (profaneWords.includes(word.toLowerCase())) {
      return "****";
    }

    return word;
  });

  // Join the words back together
  const cleanedBody = cleanedWords.join(" ");

  // Return cleaned chirp
  res.status(200).json({
    cleanedBody: cleanedBody,
  });
};

// =========================
// Global Middleware
// =========================

app.use(middlewareLogResponses);

// =========================
// API Routes
// =========================

app.get(
  "/api/healthz",
  handlerReadiness
);

app.post(
  "/api/validate_chirp",
  handlerValidateChirp
);

// =========================
// Admin Routes
// =========================

app.get(
  "/admin/metrics",
  handlerMetrics
);

app.post(
  "/admin/reset",
  handlerReset
);

// =========================
// Static Files
// =========================

app.use(
  "/app",
  middlewareMetricsInc
);

app.use(
  "/app",
  express.static("./src/app")
);

// =========================
// Error Handling Middleware
// =========================

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Custom errors
  if (err instanceof BadRequestError) {
    res.status(400).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof UnauthorizedError) {
    res.status(401).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof ForbiddenError) {
    res.status(403).json({
      error: err.message,
    });
    return;
  }

  if (err instanceof NotFoundError) {
    res.status(404).json({
      error: err.message,
    });
    return;
  }

  // Unknown errors
  console.log(err);

  res.status(500).json({
    error: "Something went wrong on our end",
  });
}

// Error middleware must be last
app.use(errorHandler);

// =========================
// Start Server
// =========================

app.listen(PORT, () => {
  console.log(
    `Server is running at http://localhost:${PORT}`
  );
});
