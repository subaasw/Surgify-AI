from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import SimulationResult
from ..schemas import SimulationResultOut
from ..services.data_store import ApiError
from .sessions import _result_out

router = APIRouter()


@router.get("/results", response_model=list[SimulationResultOut])
def list_results(limit: int = 20, db: Session = Depends(get_db)):
    rows = (db.query(SimulationResult).order_by(SimulationResult.completed_at.desc())
            .limit(min(limit, 100)).all())
    return [_result_out(r) for r in rows]


@router.get("/results/{result_id}", response_model=SimulationResultOut)
def get_result(result_id: str, db: Session = Depends(get_db)):
    result = db.get(SimulationResult, result_id)
    if not result:
        raise ApiError(404, "RESULT_NOT_FOUND", f"Unknown result '{result_id}'.")
    return _result_out(result)
