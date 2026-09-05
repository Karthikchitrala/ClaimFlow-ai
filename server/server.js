// server/server.js
// ClaimFlow AI Main Express Server

import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import apiRouter from "./routes/api.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Serve static frontend files
app.use(express.static(path.join(rootDir, "public")));

// API routes (support both /api prefixed and direct routes)
app.use("/api", apiRouter);
app.use(apiRouter);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "ClaimFlow AI",
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "ClaimFlow AI",
    timestamp: new Date().toISOString()
  });
});

// Fallback to index.html
app.get("*", (req, res) => {
  res.sendFile(path.join(rootDir, "public", "index.html"));
});

// Only start the listener if running as a standalone server (not in Vercel serverless or when imported)
const isDirectRun = process.argv[1] && (
  path.resolve(process.argv[1]) === __filename ||
  process.argv[1].endsWith("server.js")
);

if (isDirectRun && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`
=====================================================
  🚀 ClaimFlow AI Server is running!
  🌐 URL: http://localhost:${PORT}
  📁 Serving frontend from: public/
  ⚡ Environment: ${process.env.NODE_ENV || "development"}
=====================================================
    `);
  });
}

export default app;
