"""
CyberRAT v2 — Entry Point
===========================
Author  : Syed Mubashir Ahmed Hashmi (20089221)
Project : AI-CRAF Dissertation — DBS Dublin
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
    print(" Default accounts (passwords are in config.py or your .env):")
    print(f"   Admin   : {app.config['SEED_ADMIN_EMAIL']}")
    print(f"   Analyst : {app.config['SEED_ANALYST_EMAIL']}")
    print("=" * 60)

    app.run(
        host  = "0.0.0.0",
        port  = int(os.getenv("PORT", 5000)),
        debug = (os.getenv("FLASK_ENV", "development") == "development"),
    )
