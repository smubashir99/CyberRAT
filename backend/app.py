"""
CyberRAT v2 — Entry Point
===========================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : CRAF Dissertation — DBS Dublin
Purpose : Start the Flask development server.

Usage:
    cd backend
    python app.py                   # development
    FLASK_ENV=production python app.py

Or with Flask CLI:
    flask run --port 5000 --debug
"""

import os
from app import create_app

# Create the application instance
app = create_app(os.getenv("FLASK_ENV", "development"))

if __name__ == "__main__":
    print("=" * 60)
    print(" CyberRAT v2 — AI-CRAF Cybersecurity Assessment Tool")
    print("=" * 60)
    print(f" Environment : {os.getenv('FLASK_ENV', 'development')}")
    print(f" API Base    : http://localhost:5000/api")
    print(f" Health Check: http://localhost:5000/api/health")
    print(f" ECDH Key    : http://localhost:5000/api/crypto/server-key")
    print("=" * 60)
    print(" Default Credentials:")
    print("   Admin   : admin@cyberrat.ie   / Admin@CyberRAT2026!")
    print("   Analyst : analyst@cyberrat.ie / Analyst@CyberRAT2026!")
    print("=" * 60)
# Start THE Flask development server (not for production use)
    app.run(
        host  = "0.0.0.0",
        port  = int(os.getenv("PORT", 5000)),
        debug = (os.getenv("FLASK_ENV", "development") == "development"),
    )
