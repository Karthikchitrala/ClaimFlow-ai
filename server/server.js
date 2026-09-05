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

// API routes
app.use("/api", apiRouter);

// Health check
app.get("/api/health", (req, res) => {
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
