"""SQLAlchemy models. Scenario/instrument/anatomy definitions live in JSON files, not the DB."""
from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(120), default="Guest")
    is_guest: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class SimulationSession(Base):
    __tablename__ = "simulation_sessions"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    scenario_id: Mapped[str] = mapped_column(String(80), index=True)
    user_id: Mapped[str | None] = mapped_column(String(40), nullable=True)
    mode: Mapped[str] = mapped_column(String(20), default="virtual_patient")
    status: Mapped[str] = mapped_column(String(20), default="created")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    elapsed_seconds: Mapped[int] = mapped_column(Integer, default=0)
    current_step_index: Mapped[int] = mapped_column(Integer, default=0)
    selected_region: Mapped[str | None] = mapped_column(String(60), nullable=True)
    selected_tool: Mapped[str | None] = mapped_column(String(60), nullable=True)
    camera_mode: Mapped[str] = mapped_column(String(20), default="room")
    score: Mapped[float] = mapped_column(Float, default=0.0)
    completed_step_ids: Mapped[list] = mapped_column(JSON, default=list)
    checklist: Mapped[dict] = mapped_column(JSON, default=dict)
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    # engine scratch state: counters, ordered-rule progress, raw measurements, hints used
    engine_state: Mapped[dict] = mapped_column(JSON, default=dict)


class SimulationEvent(Base):
    __tablename__ = "simulation_events"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(40), ForeignKey("simulation_sessions.id"), index=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    elapsed_ms: Mapped[int] = mapped_column(Integer, default=0)
    event_type: Mapped[str] = mapped_column(String(40), default="interaction")
    action: Mapped[str] = mapped_column(String(60))
    target: Mapped[str | None] = mapped_column(String(80), nullable=True)
    tool_id: Mapped[str | None] = mapped_column(String(60), nullable=True)
    body_region: Mapped[str | None] = mapped_column(String(60), nullable=True)
    meta: Mapped[dict] = mapped_column(JSON, default=dict)
    accepted: Mapped[bool] = mapped_column(Boolean, default=True)
    score_delta: Mapped[float] = mapped_column(Float, default=0.0)
    feedback_code: Mapped[str | None] = mapped_column(String(60), nullable=True)


class SimulationResult(Base):
    __tablename__ = "simulation_results"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(40), ForeignKey("simulation_sessions.id"), unique=True, index=True)
    scenario_id: Mapped[str] = mapped_column(String(80))
    final_score: Mapped[float] = mapped_column(Float, default=0.0)
    grade: Mapped[str] = mapped_column(String(40), default="")
    metrics: Mapped[dict] = mapped_column(JSON, default=dict)
    strengths: Mapped[list] = mapped_column(JSON, default=list)
    improvements: Mapped[list] = mapped_column(JSON, default=list)
    missed_actions: Mapped[list] = mapped_column(JSON, default=list)
    critical_errors: Mapped[list] = mapped_column(JSON, default=list)
    event_timeline: Mapped[list] = mapped_column(JSON, default=list)
    coach_summary: Mapped[str] = mapped_column(Text, default="")
    completed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class CoachMessageRow(Base):
    __tablename__ = "coach_messages"

    id: Mapped[str] = mapped_column(String(40), primary_key=True)
    session_id: Mapped[str] = mapped_column(String(40), ForeignKey("simulation_sessions.id"), index=True)
    type: Mapped[str] = mapped_column(String(20))
    code: Mapped[str] = mapped_column(String(60))
    message: Mapped[str] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(Integer, default=5)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    related_step_id: Mapped[str | None] = mapped_column(String(80), nullable=True)
    suggested_action: Mapped[str | None] = mapped_column(String(80), nullable=True)


class TrajectoryPoint(Base):
    __tablename__ = "trajectory_points"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(40), ForeignKey("simulation_sessions.id"), index=True)
    timestamp_ms: Mapped[int] = mapped_column(Integer)
    x: Mapped[float] = mapped_column(Float)
    y: Mapped[float] = mapped_column(Float)
    z: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    tool_id: Mapped[str] = mapped_column(String(60), default="needle_holder")
