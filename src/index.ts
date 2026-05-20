import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import morgan from "morgan";
import compression from "compression";
import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "./config/db";
import { initTokens } from "./utils/tokens";
import authRoutes from "./routes/auth";
import privateRoutes from "./routes/private";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ─────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// HTTP request logging (dev: colorized concise, prod: combined)
app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")
);

// ─── Rate limiting for auth routes ─────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});
app.use("/api/auth", authLimiter);

// ─── Routes ────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/protected", privateRoutes);

// ─── Global error handler ──────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  // Log the full error for debugging
  console.error("Unhandled error:", err);

  // Don't leak error details in production
  res.status(500).json({
    success: false,
    message: "Internal server error.",
  });
});

// ─── Health check ──────────────────────────────
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "API is running",
    timestamp: new Date().toISOString(),
  });
});

// ─── Start server ──────────────────────────────
const start = async () => {
  try {
    // Validate JWT secrets are set (must happen after dotenv.config())
    initTokens();

    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📚 Health check: http://localhost:${PORT}/api/health`);
    });

    // ─── Server error handler (catch EADDRINUSE, etc.) ──
    server.on("error", async (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use.`);
        console.error(`   Kill it with: kill $(lsof -ti :${PORT})`);
      } else {
        console.error("❌ Server error:", err);
      }
      await mongoose.connection.close();
      process.exit(1);
    });

    // ─── Graceful shutdown ─────────────────────
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(async () => {
        await mongoose.connection.close();
        console.log("MongoDB connection closed.");
        process.exit(0);
      });

      // Force shutdown after 10s
      setTimeout(() => {
        console.error("Forced shutdown after timeout.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // Handle unhandled rejections and uncaught exceptions with graceful shutdown
    process.on("unhandledRejection", (reason: Error) => {
      console.error("❌ Unhandled Rejection:", reason);
      gracefulShutdown("unhandledRejection");
    });

    process.on("uncaughtException", (error: Error) => {
      console.error("❌ Uncaught Exception:", error);
      gracefulShutdown("uncaughtException");
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

start();
