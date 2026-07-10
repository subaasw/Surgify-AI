"""Read-only catalog endpoints: health, scenarios, patients, instruments, anatomy."""
from fastapi import APIRouter

from ..config import get_settings
from ..schemas import (AnatomyRegionOut, InstrumentOut, InstrumentPartOut, PatientQuestionRequest,
                       PatientQuestionResponse, PatientVitalsOut, ScenarioDetail, ScenarioSummary,
                       VirtualPatientOut)
from ..services.data_store import ApiError, store
from .deps import patient_out, scenario_summary

router = APIRouter()
settings = get_settings()


@router.get("/health")
def health():
    return {"status": "ok", "service": "surgify-ai-backend", "version": settings.version}


# ---------- scenarios ----------

@router.get("/scenarios", response_model=list[ScenarioSummary])
def list_scenarios(difficulty: str | None = None, skill: str | None = None, available: bool | None = None):
    items = list(store.scenarios.values())
    if difficulty:
        items = [s for s in items if s["difficulty"].lower() == difficulty.lower()]
    if skill:
        items = [s for s in items if any(skill.lower() in o.lower() for o in s["objectives"])]
    if available is not None:
        items = [s for s in items if s["is_available"] == available]
    return [scenario_summary(s) for s in items]


@router.get("/scenarios/{scenario_id}", response_model=ScenarioDetail)
def get_scenario(scenario_id: str):
    return scenario_summary(store.get_scenario(scenario_id))


@router.get("/scenarios/{scenario_id}/patient", response_model=VirtualPatientOut)
def get_scenario_patient(scenario_id: str):
    return patient_out(store.get_patient(store.get_scenario(scenario_id)["patient_id"]))


@router.get("/scenarios/{scenario_id}/tools", response_model=list[InstrumentOut])
def get_scenario_tools(scenario_id: str):
    return [store.get_instrument(t) for t in store.get_scenario(scenario_id)["required_tools"]]


@router.get("/scenarios/{scenario_id}/anatomy-regions", response_model=list[AnatomyRegionOut])
def get_scenario_regions(scenario_id: str):
    return [store.get_region(r) for r in store.get_scenario(scenario_id)["body_regions"]]


# ---------- patients ----------

@router.get("/patients/{patient_id}", response_model=VirtualPatientOut)
def get_patient(patient_id: str):
    return patient_out(store.get_patient(patient_id))


@router.get("/patients/{patient_id}/vitals", response_model=PatientVitalsOut)
def get_patient_vitals(patient_id: str):
    return store.get_patient(patient_id)["vital_signs"]


@router.get("/patients/{patient_id}/dialogue")
def get_patient_dialogue(patient_id: str):
    p = store.get_patient(patient_id)
    return {"patient_id": p["id"],
            "questions": [{"question_id": d["question_id"], "question": d["question"]} for d in p["dialogue"]]}


@router.post("/patients/{patient_id}/questions", response_model=PatientQuestionResponse)
def ask_patient_question(patient_id: str, body: PatientQuestionRequest):
    p = store.get_patient(patient_id)
    entry = next((d for d in p["dialogue"] if d["question_id"] == body.question_id), None)
    if not entry:  # only predefined questions — no free-form medical dialogue
        raise ApiError(404, "QUESTION_NOT_FOUND",
                       f"Unknown question '{body.question_id}'. Only predefined questions are permitted.",
                       {"available": [d["question_id"] for d in p["dialogue"]]})
    return {"question_id": entry["question_id"], "answer": entry["answer"],
            "emotion": entry.get("emotion", "neutral"), "audio_url": None}


# ---------- instruments ----------

@router.get("/instruments", response_model=list[InstrumentOut])
def list_instruments():
    return list(store.instruments.values())


@router.get("/instruments/{instrument_id}", response_model=InstrumentOut)
def get_instrument(instrument_id: str):
    return store.get_instrument(instrument_id)


@router.get("/instruments/{instrument_id}/parts", response_model=list[InstrumentPartOut])
def get_instrument_parts(instrument_id: str):
    return store.get_instrument(instrument_id).get("parts", [])


# ---------- anatomy ----------

@router.get("/anatomy/regions", response_model=list[AnatomyRegionOut])
def list_regions():
    return list(store.regions.values())


@router.get("/anatomy/regions/{region_id}", response_model=AnatomyRegionOut)
def get_region(region_id: str):
    return store.get_region(region_id)


@router.get("/anatomy/regions/{region_id}/structures")
def get_region_structures(region_id: str):
    r = store.get_region(region_id)
    return {"region_id": r["id"], "structures": r["structures"],
            "disclaimer": "Educational visualization only. Not intended for diagnosis or procedure planning."}
