"""Lightweight mock vitals simulator — visual realism only, not a physiological model."""
import random


def next_vitals(previous: dict) -> dict:
    def drift(value: float, delta: float, lo: float, hi: float) -> float:
        return max(lo, min(hi, value + random.uniform(-delta, delta)))

    return {
        "heart_rate": round(drift(previous.get("heart_rate", 88), 3, 82, 96)),
        "systolic_bp": round(drift(previous.get("systolic_bp", 122), 2, 116, 128)),
        "diastolic_bp": round(drift(previous.get("diastolic_bp", 78), 2, 72, 84)),
        "spo2": round(drift(previous.get("spo2", 98), 1, 97, 99)),
        "respiratory_rate": round(drift(previous.get("respiratory_rate", 16), 1, 15, 17)),
        "temperature_c": round(drift(previous.get("temperature_c", 36.8), 0.1, 36.5, 37.1), 1),
    }
