# server.py
"""
ClaimFlow AI - Python Application Launcher
Run with: python server.py
"""

import os
import sys

# Ensure UTF-8 output on Windows consoles
if sys.platform == "win32":
    os.environ["PYTHONIOENCODING"] = "utf-8"

import uvicorn
from server_py.main import app  # Top-level FastAPI instance required by Vercel

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    print("=====================================================")
    print("  🚀 ClaimFlow AI Python Server is starting...")
    print(f"  🌐 Web Application: http://localhost:{port}")
    print(f"  📖 Interactive API Docs (Swagger): http://localhost:{port}/docs")
    print("  ⚡ Runtime: Python 3.12 + FastAPI + Uvicorn")
    print("=====================================================")

    uvicorn.run(app, host="0.0.0.0", port=port, reload=True)
