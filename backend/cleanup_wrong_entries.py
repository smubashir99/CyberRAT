#!/usr/bin/env python3
"""
CyberRAT-v2 — One-time cleanup script
======================================
Deletes assessments that were submitted BEFORE the scoring bug fix
(commit edfa189) so the Results / History pages show only correct scores.

Run ONCE after updating the backend:
    cd backend
    python cleanup_wrong_entries.py

Safe to run multiple times — it only deletes rows whose
overall_score is 8.99 (the telltale wrong value from the bug).
It will NOT delete any score you submitted after the fix.
"""

import sys
import os

# Make sure Flask app context is available
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app
from app.extensions import db
from app.models.assessment import Assessment

app = create_app()

with app.app_context():
    # Find all assessments with the buggy score 8.99
    wrong = Assessment.query.filter(
        Assessment.overall_score.between(8.98, 9.00)
    ).all()

    if not wrong:
        print("✅  No wrong entries found — nothing to delete.")
        sys.exit(0)

    print(f"Found {len(wrong)} wrong assessment(s) to delete:\n")
    for a in wrong:
        print(f"  ID {a.id:3d} | {a.company_name[:45]:<45} | score={a.overall_score} | {a.created_at}")

    confirm = input("\nDelete these? (yes/no): ").strip().lower()
    if confirm != "yes":
        print("Aborted — nothing deleted.")
        sys.exit(0)

    for a in wrong:
        db.session.delete(a)
    db.session.commit()

    print(f"\n✅  Deleted {len(wrong)} wrong entry/entries. DB is clean now.")
