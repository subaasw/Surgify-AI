"""Loads scenario/instrument/patient/anatomy JSON files at startup and normalizes ids."""
import json
import uuid

from fastapi import HTTPException

from ..config import DATA_DIR


class ApiError(HTTPException):
    def __init__(self, status_code: int, code: str, message: str, details: dict | None = None):
        super().__init__(status_code=status_code, detail={
            "code": code,
            "message": message,
            "details": details or {},
            "request_id": f"req_{uuid.uuid4().hex[:10]}",
        })


class DataStore:
    def __init__(self) -> None:
        self.scenarios: dict[str, dict] = {}
        self.instruments: dict[str, dict] = {}
        self.patients: dict[str, dict] = {}
        self.regions: dict[str, dict] = {}
        self.coach_rules: dict[str, dict] = {}
        self._alias_to_region: dict[str, str] = {}
        self._label_to_tool: dict[str, str] = {}
        self.load()

    def load(self) -> None:
        for path in sorted((DATA_DIR / "scenarios").glob("*.json")):
            sc = json.loads(path.read_text())
            self.scenarios[sc["id"]] = sc
        for inst in json.loads((DATA_DIR / "instruments.json").read_text()):
            self.instruments[inst["id"]] = inst
            self._label_to_tool[inst["frontend_label"].lower()] = inst["id"]
            self._label_to_tool[inst["name"].lower()] = inst["id"]
        for p in json.loads((DATA_DIR / "patients.json").read_text()):
            self.patients[p["id"]] = p
        for r in json.loads((DATA_DIR / "anatomy_regions.json").read_text()):
            self.regions[r["id"]] = r
            for alias in r.get("aliases", []) + [r["id"], r["name"].lower(), r["frontend_label"].lower()]:
                self._alias_to_region[alias.lower()] = r["id"]
        self.coach_rules = json.loads((DATA_DIR / "coach_rules.json").read_text())

    # ---- lookups ----

    def get_scenario(self, id_or_slug: str) -> dict:
        sc = self.scenarios.get(id_or_slug)
        if not sc:
            sc = next((s for s in self.scenarios.values() if s["slug"] == id_or_slug), None)
        if not sc:
            raise ApiError(404, "SCENARIO_NOT_FOUND", f"Unknown scenario '{id_or_slug}'.")
        return sc

    def get_patient(self, patient_id: str) -> dict:
        p = self.patients.get(patient_id)
        if not p:
            raise ApiError(404, "PATIENT_NOT_FOUND", f"Unknown patient '{patient_id}'.")
        return p

    def get_instrument(self, instrument_id: str) -> dict:
        i = self.instruments.get(self.normalize_tool(instrument_id) or instrument_id)
        if not i:
            raise ApiError(404, "INSTRUMENT_NOT_FOUND", f"Unknown instrument '{instrument_id}'.")
        return i

    def get_region(self, region_id: str) -> dict:
        r = self.regions.get(self.normalize_region(region_id) or region_id)
        if not r:
            raise ApiError(404, "REGION_NOT_FOUND", f"Unknown anatomy region '{region_id}'.")
        return r

    # ---- frontend-label adapter ----

    def normalize_region(self, value: str | None) -> str | None:
        if not value:
            return value
        key = value.strip().lower().replace("_", " ")
        return self._alias_to_region.get(key) or self._alias_to_region.get(value.strip().lower()) or (
            value if value in self.regions else None
        )

    def normalize_tool(self, value: str | None) -> str | None:
        if not value:
            return value
        if value in self.instruments:
            return value
        key = value.strip().lower()
        return self._label_to_tool.get(key) or self._label_to_tool.get(key.replace("_", " ")) or (
            key.replace(" ", "_") if key.replace(" ", "_") in self.instruments else None
        )


store = DataStore()
