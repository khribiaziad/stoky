"""
Migration: create team_member_rate_history table.
Run once: python migrate_rate_history.py
"""
from database import engine, Base
import models  # ensures TeamMemberRateHistory is registered

from sqlalchemy import inspect, text

inspector = inspect(engine)
if "team_member_rate_history" not in inspector.get_table_names():
    models.TeamMemberRateHistory.__table__.create(bind=engine)
    print("Created table: team_member_rate_history")
else:
    print("Table already exists: team_member_rate_history")
